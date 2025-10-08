// @ts-nocheck
import { base } from "$app/paths";
import Cron from 'croner';

function siteDataExtractFromDb(data, obj) {
  let requestedObject = { ...obj };
  for (const key in requestedObject) {
    if (Object.prototype.hasOwnProperty.call(requestedObject, key)) {
      const element = data[key];
      if (data[key]) {
        requestedObject[key] = data[key];
      }
    }
  }
  //remove any keys that are still null or empty
  for (const key in requestedObject) {
    if (Object.prototype.hasOwnProperty.call(requestedObject, key)) {
      const element = requestedObject[key];
      if (element === null || element === "") {
        delete requestedObject[key];
      }
    }
  }
  return requestedObject;
}

//a function to make an api call to /manage/api/ to store site data
function storeSiteData(data) {
  return fetch(base + "/manage/app/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "storeSiteData", data }),
  });
}
const allRecordTypes = {
  A: 1,
  NS: 2,
  MD: 3,
  MF: 4,
  CNAME: 5,
  SOA: 6,
  MB: 7,
  MG: 8,
  MR: 9,
  NULL: 10,
  WKS: 11,
  PTR: 12,
  HINFO: 13,
  MINFO: 14,
  MX: 15,
  TXT: 16,
  RP: 17,
  AFSDB: 18,
  X25: 19,
  ISDN: 20,
  RT: 21,
  NSAP: 22,
  NSAP_PTR: 23,
  SIG: 24,
  KEY: 25,
  PX: 26,
  GPOS: 27,
  AAAA: 28,
  LOC: 29,
  NXT: 30,
  EID: 31,
  NIMLOC: 32,
  SRV: 33,
  ATMA: 34,
  NAPTR: 35,
  KX: 36,
  CERT: 37,
  A6: 38,
  DNAME: 39,
  SINK: 40,
  OPT: 41,
  APL: 42,
  DS: 43,
  SSHFP: 44,
  IPSECKEY: 45,
  RRSIG: 46,
  NSEC: 47,
  DNSKEY: 48,
  DHCID: 49,
  NSEC3: 50,
  NSEC3PARAM: 51,
  TLSA: 52,
  SMIMEA: 53,
  HIP: 55,
  NINFO: 56,
  RKEY: 57,
  TALINK: 58,
  CDS: 59,
  CDNSKEY: 60,
  OPENPGPKEY: 61,
  CSYNC: 62,
  SPF: 99,
  UINFO: 100,
  UID: 101,
  GID: 102,
  UNSPEC: 103,
  NID: 104,
  L32: 105,
  L64: 106,
  LP: 107,
  EUI48: 108,
  EUI64: 109,
  TKEY: 249,
  TSIG: 250,
  IXFR: 251,
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ANY: 255,
};
const ValidateIpAddress = function (input) {
  // Check if input is a valid IPv4 address with an optional port
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(input)) {
    return "IP4";
  }

  // Improved IPv6 regex that better handles compressed notation
  const ipv6Regex =
    /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){0,7}:|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){6}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|(?:[0-9a-fA-F]{1,4}:){1,7}(?::|:[0-9a-fA-F]{1,4})|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:))$/;
  if (ipv6Regex.test(input)) {
    return "IP6";
  }

  // Check if input is a valid domain name with an optional port
  const domainRegex = /^[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
  if (domainRegex.test(input)) {
    return "DOMAIN";
  }

  // If none of the above conditions match, the input is invalid
  return "Invalid";
};

function IsValidHost(domain) {
  const regex = /^[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
  return regex.test(domain);
}
function IsValidNameServer(nameServer) {
  //8.8.8.8 example
  const regex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
  return regex.test(nameServer);
}
const IsValidURL = function (url) {
  return /^(http|https):\/\/[^ "]+$/.test(url);
};
function ValidateCronExpression(cronExp) {
  // Check if expression is provided and is a string
  if (!cronExp || typeof cronExp !== "string") {
    return { isValid: false, message: "Cron expression must be a non-empty string" };
  }

  // Split the expression into its components
  const fields = cronExp.trim().split(/\s+/);

  // Standard cron should have 5 or 6 fields
  // minute hour day-of-month month day-of-week [year]
  if (fields.length < 5 || fields.length > 6) {
    return {
      isValid: false,
      message: "Cron expression must have 5 or 6 fields",
    };
  }

  // Define field constraints
  const fieldConstraints = [
    { name: "minute", min: 0, max: 59 },
    { name: "hour", min: 0, max: 23 },
    { name: "day", min: 1, max: 31 },
    { name: "month", min: 1, max: 12 },
    { name: "weekday", min: 0, max: 6 },
    { name: "year", min: 1970, max: 2099 }, // Optional field
  ];

  // Valid characters in cron expressions
  const validChars = /^[\d/*,\-]+$/;

  // Validate each field
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const constraint = fieldConstraints[i];

    // Check for valid characters
    if (!validChars.test(field)) {
      return {
        isValid: false,
        message: `Invalid characters in ${constraint.name} field`,
      };
    }

    // Handle special characters
    if (field === "*") {
      continue; // Asterisk is valid for all fields
    }

    // Handle lists (comma-separated values)
    if (field.includes(",")) {
      const values = field.split(",");
      for (const value of values) {
        if (!isValidRange(value, constraint.min, constraint.max)) {
          return {
            isValid: false,
            message: `Invalid value in ${constraint.name} field: ${value}`,
          };
        }
      }
      continue;
    }

    // Handle ranges (with hyphens)
    if (field.includes("-")) {
      const [start, end] = field.split("-").map(Number);
      if (start == null || end == null || start < constraint.min || end > constraint.max || start > end) {
        return {
          isValid: false,
          message: `Invalid range in ${constraint.name} field: ${field}`,
        };
      }
      continue;
    }

    // Handle steps (with forward slash)
    if (field.includes("/")) {
      const [range, step] = field.split("/");
      if (range !== "*" && !isValidRange(range, constraint.min, constraint.max)) {
        return {
          isValid: false,
          message: `Invalid range in ${constraint.name} field: ${range}`,
        };
      }
      if (!isValidRange(step, 1, constraint.max)) {
        return {
          isValid: false,
          message: `Invalid step value in ${constraint.name} field: ${step}`,
        };
      }
      continue;
    }

    // Handle plain numbers
    if (!isValidRange(field, constraint.min, constraint.max)) {
      return {
        isValid: false,
        message: `Invalid value in ${constraint.name} field: ${field}`,
      };
    }
  }

  return { isValid: true, message: "Valid cron expression" };
}

function isValidRange(value, min, max) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}
function IsValidPort(port) {
  return isValidRange(port, 1, 65535);
}

function SortMonitor(monitorSort, resp) {
  let monitors = [];
  if (!!monitorSort && monitorSort.length > 0) {
    monitors = monitorSort.map((id) => resp.find((m) => m.id == id)).filter((m) => !!m);
    //append any new monitors
    monitors = [...monitors, ...resp.filter((m) => !monitorSort.includes(m.id))];
  } else {
    monitors = resp;
  }
  return monitors;
}
//js function to generate 32 character random string
function RandomString(length) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

/**
 * Retreive game's data from its id.
 * @param {string} id Id
 * @return Returns game's data if found, undefined instead.
 */
function GetGameFromId(list, id) {
  return list.find((game) => game.id === id);
}

/**
 * Validates if a cron expression executes at least once during the time window
 * AND at least once after the time window end on the same day.
 *
 * @param {string} cronExpression - The cron expression to validate (e.g., "15/2 21-22 * * 1-5")
 * @param {string} timeWindowStart - Start time in HH:MM format (e.g., "21:00")
 * @param {string} timeWindowEnd - End time in HH:MM format (e.g., "22:00")
 * @returns {{valid: boolean, error: string|null}} Validation result with error message if invalid
 *
 * @example
 * // Returns {valid: true, error: null}
 * // Executes during window (21:15, 21:17...) and after (22:15, 22:17...)
 * ValidateCronExecutionTimeWindow("15/2 21-22 * * 1-5", "21:00", "22:00")
 *
 * @example
 * // Returns {valid: false, error: "..."}
 * // Only executes at 20:00 (before window)
 * ValidateCronExecutionTimeWindow("0 20 * * *", "21:00", "22:00")
 */
function ValidateCronExecutionTimeWindow(cronExpression, timeWindowStart, timeWindowEnd) {
  try {
    // Create cron job instance
    const cronJob = Cron(cronExpression);

    // Get today's date as reference
    const today = new Date();

    // Parse window start time (HH:MM format)
    const [startHour, startMin] = timeWindowStart.split(':').map(Number);

    // Parse window end time (HH:MM format)
    const [endHour, endMin] = timeWindowEnd.split(':').map(Number);

    // Create Date object for window start time today
    const windowStart = new Date(today);
    windowStart.setHours(startHour, startMin, 0, 0);

    // Create Date object for window end time today
    const windowEnd = new Date(today);
    windowEnd.setHours(endHour, endMin, 0, 0);

    // Create Date object for end of day (23:59:59.999)
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Validate window times
    if (windowEnd <= windowStart) {
      return {
        valid: false,
        error: "Time window end must be after time window start"
      };
    }

    // Check 1: Cron executes at least once DURING the time window
    const nextRunDuringWindow = cronJob.nextRun(windowStart);

    if (!nextRunDuringWindow) {
      return {
        valid: false,
        error: `Cron does not execute after ${timeWindowEnd}`
      };
    }

    const executesDuringWindow = nextRunDuringWindow >= windowStart &&
                                 nextRunDuringWindow < windowEnd;

    if (!executesDuringWindow) {
      return {
        valid: false,
        error: "Cron must execute at least once between time window start and end"
      };
    }

    // Check 2: Cron executes at least once AFTER the time window end
    const nextRunAfterWindow = cronJob.nextRun(windowEnd);

    if (!nextRunAfterWindow) {
      return {
        valid: false,
        error: "Cron must execute at least once after the time window end"
      };
    }

    const executesAfterWindow = nextRunAfterWindow > windowEnd &&
                                nextRunAfterWindow <= endOfDay;

    if (!executesAfterWindow) {
      return {
        valid: false,
        error: "Cron must execute at least once after the time window end on the same day"
      };
    }

    // All validations passed
    return {
      valid: true,
      error: null
    };

  } catch (e) {
    // Log error and return false for invalid cron expressions
    console.error('Error validating cron execution:', e);
    return {
      valid: false,
      error: `Invalid cron expression: ${e.message}`
    };
  }
}

export {
  siteDataExtractFromDb,
  storeSiteData,
  allRecordTypes,
  ValidateIpAddress,
  IsValidHost,
  IsValidNameServer,
  IsValidURL,
  IsValidPort,
  ValidateCronExpression,
  ValidateCronExecutionTimeWindow,
  SortMonitor,
  RandomString,
  GetGameFromId,
};
