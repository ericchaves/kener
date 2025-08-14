// @ts-nocheck
import { UP, DOWN, DEGRADED, REALTIME, TIMEOUT, ERROR, MANUAL, NO_DATA } from "../constants.js";
import { GetNowTimestampUTC } from "../tool.js";
import { GetLastHeartbeat, CountPingbacks } from "../controllers/controller.js";
import Cron from "croner";

class PingbackCall {
  monitor;

  constructor(monitor) {
    this.monitor = monitor;
  }

  async execute() {
    try {
      let latestData = await GetLastHeartbeat(this.monitor.tag);
      if (!latestData) {
        return {
          status: this.monitor.default_status,
          latency: 0,
          type: REALTIME,
        };
      }

      const { degradedCount, upCount, timeWindowStart, timeWindowEnd, window_mode } = this.monitor.type_data;

      // Validações
      if (!window_mode) {
        throw new Error("window_mode is required");
      }

      if (upCount === undefined || degradedCount === undefined) {
        throw new Error("upCount and degradedCount are required");
      }

      const nowInSeconds = GetNowTimestampUTC();
      let pingbacks = 0;

      // DYNAMIC uses the result of the last pingback
      if(window_mode === "DYNAMIC"){
        return {
          status: latestData.type === ERROR ? DOWN : latestData.status,
          latency: 0,
          type: latestData.type === ERROR ? ERROR : REALTIME,
        };
      }

      // Helper: Get end of current day in seconds
      const getEndOfDayInSeconds = () => {
        let endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return Math.floor(endOfDay.getTime() / 1000);
      };

      // FIXED window count pingbacks only in specific time window
      if(window_mode === "FIXED"){
        if (!timeWindowStart || !timeWindowEnd) {
          throw new Error("timeWindowStart and timeWindowEnd are required for FIXED mode");
        }

        let startDate = new Date();
        startDate.setHours(parseInt(timeWindowStart.split(":")[0]));
        startDate.setMinutes(parseInt(timeWindowStart.split(":")[1]));
        startDate.setSeconds(0);

        let endDate = new Date();
        endDate.setHours(parseInt(timeWindowEnd.split(":")[0]));
        endDate.setMinutes(parseInt(timeWindowEnd.split(":")[1]));
        endDate.setSeconds(0);

        const currentDate = new Date();

        // Se ainda não passou da hora de fim, retorna status padrão
        if (currentDate <= endDate) {
          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME
          };
        }

        // Limita a contagem até o final do dia atual
        const endOfDayInSeconds = getEndOfDayInSeconds();
        const previousInSeconds = Math.floor(startDate.getTime() / 1000);
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        pingbacks = await CountPingbacks(this.monitor.tag, previousInSeconds, countUntil);
      }

      // SLIDING window count pingbacks for each cron execution
      if(window_mode === "SLIDING"){
        // Use croner to calculate expected heartbeat time
        const cronJob = Cron(this.monitor.cron);
        const prevDate = cronJob.previousRun();
        const previousInSeconds = Math.floor(prevDate.getTime() / 1000);

        // Limita a contagem até o final do dia atual
        const endOfDayInSeconds = getEndOfDayInSeconds();
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        pingbacks = await CountPingbacks(this.monitor.tag, previousInSeconds, countUntil);
      }

      // Evaluate pingback count
      if (pingbacks >= upCount) {
        return {
          status: UP,
          latency: 0,
          type: REALTIME
        };
      }
      if (pingbacks >= degradedCount) {
        return {
          status: DEGRADED,
          latency: 0,
          type: REALTIME
        };
      }
      return {
        status: DOWN,
        latency: 0,
        type: REALTIME
      };
    } catch (err) {
      console.error(`Error in pingbackCall ${this.monitor.tag}`, err);
      return {
        status: DOWN,
        latency: 0,
        type: ERROR,
      };
    }
  }
}

export default PingbackCall;
