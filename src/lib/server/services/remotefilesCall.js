// @ts-nocheck
import SftpClient from 'ssh2-sftp-client';
import { Client as FtpClient } from 'basic-ftp';
import { GetRequiredSecrets, ReplaceAllOccurrences, ResolveSecrets } from "../tool.js";
import { UP, DOWN, DEGRADED, REALTIME, TIMEOUT, ERROR, MANUAL } from "../constants.js";
import { DefaultRemoteFilesEval } from '../../anywhere.js';
import version from "../../version.js";
import { parse } from 'path';
import { URL } from 'node:url';

class IRemoteServerData {
  constructor(status, latency, type, connectionLatency, listingLatency, files) {
    this.status = status;
    this.latency = latency;
    this.type = type;
    this.connectionLatency = connectionLatency;
    this.listingLatency = listingLatency;
    this.files = files;
  }
}

class IFileInfo {
  constructor(name, type, size, modifyTime, folder) {
    this.name = name; // file name
    this.type = type; // "d" for directory or "f" for file
    this.size = size; // syze in bytes
    this.modifyTime = modifyTime; // epoch, milliseconds since January 1, 1970, UTC
    this.folder = folder; // remote folder
  }
}

class RemoteServerCall {
  monitor;

  constructor(monitor) {
    this.monitor = monitor;
  }

  async execute() {
    let latency = 0;
    let timeoutError = false;
    const { type_data, tag} = this.monitor;
    // handle secrets
    let config = ResolveSecrets(type_data);

    const url = URL.parse(config.serverUrl);
    // we ignore '/' in pathname becasue URL.parse returns it even when no path was declared.
    if(url.pathname.length > 0 && url.pathname !== "/" && config.folders.indexOf(url.pathname) === -1)
      config.folders.push(url.pathname);

    config = {...config, url, tag}
    let response = undefined;
    try{
      switch (url.protocol) {
        case 'sftp:':
          response = await RemoteServerCall.executeSftp(config);
          break;
        case 'ftp:':
          config.url.searchParams.delete('secure');
        case 'ftps:':
          response = await RemoteServerCall.executeFtp(config);
          break;
        default:
          return {
            status: DOWN,
            latency: latency,
            type: ERROR,
          };
      }
      latency = response.connectionLatency + response.listingLatency;
    }catch(err){
      console.log(`Error in remotefilesCall ${tag}`, err.message);
      return {
        status: DOWN,
        latency: latency,
        type: ERROR,
      };
    }

    let evalResp = undefined;
    let monitorEval = !!this.monitor.type_data.eval ? this.monitor.type_data.eval : DefaultRemoteFilesEval;

    try {
      const evalFunction = new Function(
        "connectionTime",
        "responseTime",
        "files",
        `return (${monitorEval})(connectionTime, responseTime, files);`,
      );
      evalResp = await evalFunction(response.connectionLatency, response.listingLatency, response.files);
    } catch (error) {
      console.log(`Error in remotefilesEval for ${tag}.`, error.message);
    }

    if (evalResp === undefined || evalResp === null) {
      evalResp = {
        status: DOWN,
        latency: latency,
        type: ERROR,
      };
    } else if (
      evalResp.status === undefined ||
      evalResp.status === null ||
      [UP, DOWN, DEGRADED].indexOf(evalResp.status) === -1
    ) {
      evalResp = {
        status: DOWN,
        latency: latency,
        type: ERROR,
      };
    } else {
      evalResp.type = REALTIME;
    }

    let toWrite = {
      status: DOWN,
      latency: latency,
      type: ERROR,
    };
    if (evalResp.status !== undefined && evalResp.status !== null) {
      toWrite.status = evalResp.status;
    }
    if (evalResp.latency !== undefined && evalResp.latency !== null) {
      toWrite.latency = evalResp.latency;
    }
    if (evalResp.type !== undefined && evalResp.type !== null) {
      toWrite.type = evalResp.type;
    }
    if (timeoutError) {
      toWrite.type = TIMEOUT;
    }

    return toWrite;
  }

  static async executeSftp(config){
    let response = new IRemoteServerData(UP, 0, REALTIME, 0, 0, []);
    const { url, folders } = config;
    const opts = {
      host: url.hostname,
      port: url.port,
      username: url.username,
      password: url.password,
      privateKey: url.searchParams.get('privateKey'),
      passphrase: url.searchParams.get('passphrase'),
      readyTimeout: config.timeout || 10000,
    }
    const client = new SftpClient(config.tag);

    let mark = Date.now();
    await client.connect(opts);
    response.connectionLatency = Date.now() - mark;

    if(folders.length > 0){
      mark = Date.now();
      for(const folder of folders){
        const sftpList = await client.list(folder);
        const list= sftpList.map(item => {
          return new IFileInfo(
            item.name,
            item.type === 'd' ? 'd' : 'f',
            item.size,
            item.modifyTime,
            folder,
          );
        });
        response.files = [...response.files, ...list];
        response.listingLatency = Date.now() - mark;
      }
    }
    await client.end();
    return response;
  }

  static async executeFtp(config){
    let response = new IRemoteServerData(UP, 0, REALTIME, 0, 0, []);
    const { url, folders } = config;
    let secure = url.protocol === 'ftps:' ? url.searchParams.get('secure') ?? 'required' : null;
    if (!!secure && /require/ig.test(secure)){
      secure = true;
    }
    const opts = {
      host: url.hostname,
      port: url.port,
      user: url.username,
      password: url.password,
      secure: url.protocol === 'ftps:' ? secure : null,
      secureOptions: url.protocol === 'ftps:' ? {
        checkServerIdentity: () => { return null; },
        rejectUnauthorized: Boolean(url.searchParams.get('rejectUnauthorized') ?? 'true'),
      } : null,
    }
    const client = new FtpClient(config.timeout || 10000);
    let mark = Date.now();
    await client.access(opts);
    response.connectionLatency = Date.now() - mark;

    if(folders.length > 0){
      mark = Date.now();
      for(const folder of folders){
        const ftpList = await client.list(folder);
        const list = ftpList.map(item => {
          // basic-ftp FileType: 1 = File, 2 = Directory
          const type = item.type === 2 ? 'd' : 'f';
          let modifyTime = 0;
          if(item.modifiedAt){
            modifyTime = item.modifiedAt.getTime();
          }else if(item.rawModifiedAt){
            const modifiedDate = parseDateString(item.rawModifiedAt);
            if(modifiedDate){
              modifyTime = modifiedDate.getTime();
            };
          }
          return new IFileInfo(
            item.name,
            type,
            item.size,
            modifyTime,
            folder,
          );
        });
        response.files = [...response.files, ...list];
      }
      response.listingLatency = Date.now() - mark;
    }
    await client.close();
    return response;
  }
}

const months = {
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
};

function parseDateString(input) {
  const str = input.trim();

  // Tenta o parsing nativo do JavaScript primeiro (funciona para ISO e muitos formatos comuns)
  let date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Parsing customizado para formatos comuns de FTP e outros

  // Formato Unix FTP recente: MMM DD HH:MM (assume ano atual, ajusta se futuro)
  let match = str.match(/^([a-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})$/i);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const month = months[monthStr];
    if (month !== undefined) {
      const day = parseInt(match[2], 10);
      const hour = parseInt(match[3], 10);
      const min = parseInt(match[4], 10);
      const year = new Date().getFullYear();
      date = new Date(year, month, day, hour, min);
      // Se a data for no futuro, assume ano anterior (lógica comum em clientes FTP)
      if (date > new Date()) {
        date.setFullYear(year - 1);
      }
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Formato Unix FTP antigo: MMM DD YYYY
  match = str.match(/^([a-z]{3})\s+(\d{1,2})\s+(\d{4})$/i);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const month = months[monthStr];
    if (month !== undefined) {
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
  }

  // Formato DOS/Windows FTP: MM-DD-YY HH:MMAM/PM
  match = str.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})([AP]M)$/i);
  if (match) {
    let month = parseInt(match[1], 10) - 1;
    let day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    year = year < 70 ? 2000 + year : 1900 + year; // Pivot Y2K
    let hour = parseInt(match[4], 10);
    let min = parseInt(match[5], 10);
    let ampm = match[6].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(year, month, day, hour, min);
  }

  // Formato DOS com ano de 4 dígitos: MM-DD-YYYY HH:MMAM/PM
  match = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})([AP]M)$/i);
  if (match) {
    let month = parseInt(match[1], 10) - 1;
    let day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    let hour = parseInt(match[4], 10);
    let min = parseInt(match[5], 10);
    let ampm = match[6].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(year, month, day, hour, min);
  }

  // Formato DD MMM YYYY
  match = str.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const month = months[monthStr];
    const year = parseInt(match[3], 10);
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Formato DD MMM YYYY HH:MM
  match = str.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})$/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const month = months[monthStr];
    const year = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    if (month !== undefined) {
      return new Date(year, month, day, hour, min);
    }
  }

  // Formato MDTM FTP: YYYYMMDDHHMMSS
  match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    const sec = parseInt(match[6], 10);
    return new Date(year, month, day, hour, min, sec);
  }

  // Se nenhum formato corresponder, retorna null
  return null;
}

export default RemoteServerCall;
