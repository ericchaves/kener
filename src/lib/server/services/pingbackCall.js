// @ts-nocheck
import { UP, DOWN, DEGRADED, REALTIME, TIMEOUT, ERROR, MANUAL, NO_DATA } from "../constants.js";
import { GetNowTimestampUTC, GetDayEndTimestampUTC, GetDayStartTimestampUTC } from "../tool.js";
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

      const { degradedCount, upCount, timeWindowStart, timeWindowEnd, windowMode } = this.monitor.type_data;

      // Validações
      if (!windowMode) {
        throw new Error("window_mode is required");
      }

      if (/FIXED|SLIDING/.test(windowMode) && upCount === undefined || degradedCount === undefined) {
        throw new Error("upCount and degradedCount are required");
      }

      const nowInSeconds = GetNowTimestampUTC();
      let pingbacks = 0;

      // DYNAMIC
      if(windowMode === "DYNAMIC"){
        const todayInSeconds = GetDayStartTimestampUTC(nowInSeconds);

        // Reset to default status if last pingback was from a previous day
        if(latestData.timestamp < todayInSeconds){
          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME,
          };
        }

        let finalStatus = latestData.status;
        if (latestData.status === UP && latestData.latency > 0) {
          const { degradedTimeout, timeout } = this.monitor.type_data;

          if (latency >= timeout) {
            finalStatus = DOWN;
          } else if (latency >= degradedTimeout) {
            finalStatus = DEGRADED;
          }
        }

        // Use status from today's last pingback
        return {
          status: finalStatus,
          latency: latestData.latency,
          type: latestData.type === ERROR ? ERROR : REALTIME,
        };
      }

      // FIXED window count pingbacks only in specific time window
      if(windowMode === "FIXED"){
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

        // Se ainda não passou da hora de fim, retorna status padrão
        const currentDate = new Date();
        if (currentDate <= endDate) {
          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME
          };
        }

        // Limita a contagem até o final do dia atual
        const endOfDayInSeconds = GetDayEndTimestampUTC();
        const windowStartInSeconds = Math.floor(startDate.getTime() / 1000);
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        pingbacks = await CountPingbacks(this.monitor.tag, windowStartInSeconds, countUntil);
      }

      // SLIDING window count pingbacks for each cron execution
      if(windowMode === "SLIDING"){
        // Use croner to calculate expected heartbeat time
        const cronJob = Cron(this.monitor.cron);
        const prevDate = cronJob.previousRun();
        const previousInSeconds = Math.floor(prevDate.getTime() / 1000);

        // Limita a contagem até o final do dia atual
        const endOfDayInSeconds = GetDayEndTimestampUTC();
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
