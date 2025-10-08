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

  /**
   * Evaluates pingback count and returns appropriate status
   * @param {number} pingbacks - Number of pingbacks received
   * @param {number} upCount - Threshold for UP status
   * @param {number} degradedCount - Threshold for DEGRADED status (0 = disabled)
   * @returns {string} Status: UP, DEGRADED, or DOWN
   */
  evaluatePingbackStatus(pingbacks, upCount, degradedCount) {
    if (pingbacks >= upCount) {
      return UP;
    }

    // If degradedCount is 0, skip DEGRADED and go straight to DOWN
    if (degradedCount === 0) {
      return DOWN;
    }

    if (pingbacks >= degradedCount) {
      return DEGRADED;
    }

    return DOWN;
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

      // Validations
      if (!windowMode) {
        throw new Error("window_mode is required");
      }

      if (/FIXED|SLIDING/.test(windowMode) && (upCount === undefined || degradedCount === undefined)) {
        throw new Error("upCount and degradedCount are required for FIXED/SLIDING modes");
      }

      const nowInSeconds = GetNowTimestampUTC();
      let pingbacks = 0;

      // DYNAMIC mode
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

        // Validate timeouts for DYNAMIC mode
        const { degradedTimeout, timeout } = this.monitor.type_data;
        if (timeout === undefined || degradedTimeout === undefined) {
          throw new Error("timeout and degradedTimeout are required for DYNAMIC mode");
        }

        let finalStatus = latestData.status;

        // If eval had an error, return DOWN
        if (latestData.type === ERROR) {
          return {
            status: DOWN,
            latency: latestData.latency || 0,
            type: ERROR,
          };
        }

        // Evaluate latency only if status is UP and latency > 0
        if (latestData.status === UP && latestData.latency > 0) {
          if (latestData.latency >= timeout) {
            finalStatus = DOWN;
          } else if (degradedTimeout > 0 && latestData.latency >= degradedTimeout) {
            // Only evaluate DEGRADED if degradedTimeout > 0
            finalStatus = DEGRADED;
          }
          // If latency < degradedTimeout or degradedTimeout = 0, keep UP
        }

        // Use status from today's last pingback
        return {
          status: finalStatus,
          latency: latestData.latency || 0,
          type: REALTIME,
        };
      }

      // FIXED window mode - count pingbacks only in specific time window
      if(windowMode === "FIXED"){
        if (!timeWindowStart || !timeWindowEnd) {
          throw new Error("timeWindowStart and timeWindowEnd are required for FIXED mode");
        }

        // Parse time window start and end
        const [startHour, startMin] = timeWindowStart.split(":").map(Number);
        const [endHour, endMin] = timeWindowEnd.split(":").map(Number);

        // Create Date objects for window start and end times
        let startDate = new Date();
        startDate.setHours(startHour, startMin, 0, 0);

        let endDate = new Date();
        endDate.setHours(endHour, endMin, 0, 0);

        const currentDate = new Date();

        // Rule 1: Before window start - return default status
        if (currentDate < startDate) {
          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME
          };
        }

        // Rule 2: Between window start and end
        if (currentDate >= startDate && currentDate <= endDate) {
          const windowStartInSeconds = Math.floor(startDate.getTime() / 1000);
          const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);
          const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

          pingbacks = await CountPingbacks(this.monitor.tag, windowStartInSeconds, countUntil);

          // Only return UP if upCount is met, otherwise return default status
          if (pingbacks >= upCount) {
            return {
              status: UP,
              latency: 0,
              type: REALTIME
            };
          }

          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME
          };
        }

        // Rule 3: After window end - evaluate pingback count against all thresholds
        if (currentDate > endDate) {
          const windowStartInSeconds = Math.floor(startDate.getTime() / 1000);
          const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);
          const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

          pingbacks = await CountPingbacks(this.monitor.tag, windowStartInSeconds, countUntil);

          // Evaluate status based on pingback count
          const status = this.evaluatePingbackStatus(pingbacks, upCount, degradedCount);

          return {
            status: status,
            latency: 0,
            type: REALTIME
          };
        }
      }

      // SLIDING window mode - count pingbacks for each cron execution
      if(windowMode === "SLIDING"){
        // Use croner to calculate expected heartbeat time
        const cronJob = Cron(this.monitor.cron);
        const prevDate = cronJob.previousRun();
        const previousInSeconds = Math.floor(prevDate.getTime() / 1000);

        // Limit counting to the end of current day
        const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        pingbacks = await CountPingbacks(this.monitor.tag, previousInSeconds, countUntil);

        // Evaluate status based on pingback count
        const status = this.evaluatePingbackStatus(pingbacks, upCount, degradedCount);

        return {
          status: status,
          latency: 0,
          type: REALTIME
        };
      }

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
