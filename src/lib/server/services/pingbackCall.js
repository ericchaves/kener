// @ts-nocheck
import { UP, DOWN, DEGRADED, REALTIME, TIMEOUT, ERROR, MANUAL, NO_DATA } from "../constants.js";
import { GetNowTimestampUTC, GetDayEndTimestampUTC, GetDayStartTimestampUTC } from "../tool.js";
import { GetLastHeartbeat, CountPingbacksByStatus } from "../controllers/controller.js";
import Cron from "croner";

class PingbackCall {
  monitor;

  constructor(monitor) {
    if (!monitor) {
      throw new Error("Monitor object is required for PingbackCall");
    }
    if (!monitor.tag) {
      throw new Error("Monitor must have a tag property");
    }
    this.monitor = monitor;
  }

  /**
   * Evaluates pingback counts by status and returns appropriate status
   * @param {Object} counts - Pingback counts by status {UP, DOWN, DEGRADED}
   * @param {number} upCount - Threshold for UP status
   * @param {number} degradedCount - Threshold for DEGRADED status (0 = disabled)
   * @returns {string} Status: UP, DEGRADED, or DOWN
   */
  evaluatePingbackStatus(counts, upCount, degradedCount) {
    // Rule 1: If UP count meets threshold, system is UP
    if (counts.UP >= upCount) {
      return UP;
    }

    // Rule 2: If degradedCount is configured (> 0)
    if (degradedCount > 0) {
      // Case A: DEGRADED count meets threshold
      if (counts.DEGRADED >= degradedCount) {
        return DEGRADED;
      }

      // Case B: UP count didn't meet upCount, but meets degradedCount
      // (system sent some UPs, but not enough to be UP, but enough to not be DOWN)
      if (counts.UP >= degradedCount) {
        return DEGRADED;
      }
    }

    // Rule 3: Neither UP nor DEGRADED thresholds met
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

      if (!this.monitor.type_data) {
        throw new Error(`Monitor ${this.monitor.tag} is missing type_data configuration`);
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

      // DYNAMIC mode - evaluates latency of last pingback
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

      // CUMULATIVE mode - count all pingbacks from start of day until now
      if(windowMode === "CUMULATIVE"){
        const todayStartInSeconds = GetDayStartTimestampUTC(nowInSeconds);
        const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        // Count pingbacks by status since start of day
        const counts = await CountPingbacksByStatus(
          this.monitor.tag,
          todayStartInSeconds,
          countUntil
        );

        // Evaluate status based on counts
        const status = this.evaluatePingbackStatus(counts, upCount, degradedCount);

        return {
          status: status,
          latency: 0,
          type: REALTIME
        };
      }

      // FIXED window mode - count pingbacks only in specific time window
      if(windowMode === "FIXED"){
        if (!timeWindowStart || !timeWindowEnd) {
          throw new Error("timeWindowStart and timeWindowEnd are required for FIXED mode");
        }

        if (typeof timeWindowStart !== 'string' || typeof timeWindowEnd !== 'string') {
          throw new Error("timeWindowStart and timeWindowEnd must be valid time strings");
        }
        // Parse time window start and end
        const [startHour, startMin] = timeWindowStart.split(":").map(Number);
        const [endHour, endMin] = timeWindowEnd.split(":").map(Number);

        if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
          throw new Error("Invalid time format in timeWindowStart or timeWindowEnd");
        }
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

        // Calculate counting period (from window start to now, limited to end of day)
        const windowStartInSeconds = Math.floor(startDate.getTime() / 1000);
        const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);
        const countUntil = Math.min(nowInSeconds, endOfDayInSeconds);

        // Count pingbacks by status
        const counts = await CountPingbacksByStatus(
          this.monitor.tag,
          windowStartInSeconds,
          countUntil
        );

        // Rule 2: During window - report only UP if threshold met, otherwise default status
        if (currentDate >= startDate && currentDate <= endDate) {
          if (counts.UP >= upCount) {
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

        // Rule 3: After window end - evaluate all statuses (UP/DEGRADED/DOWN)
        if (currentDate > endDate) {
          const status = this.evaluatePingbackStatus(counts, upCount, degradedCount);

          return {
            status: status,
            latency: 0,
            type: REALTIME
          };
        }
      }

      // SLIDING window mode - count pingbacks from previous cron execution period
      if(windowMode === "SLIDING"){
        if (!this.monitor.cron || typeof this.monitor.cron !== 'string') {
          throw new Error(`Monitor ${this.monitor.tag} requires valid cron expression for SLIDING mode`);
        }
        // Use croner to calculate previous execution window
        const cronJob = Cron(this.monitor.cron);
        const currentRunDate = cronJob.nextRun(new Date(nowInSeconds * 1000 - 1000)); // Current run
        const previousRunDate = cronJob.previousRun(currentRunDate);

        // if we dont have a previous run return default_status
        if (!previousRunDate || !currentRunDate) {
          return {
            status: this.monitor.default_status,
            latency: 0,
            type: REALTIME
          };
        }
        const previousRunInSeconds = Math.floor(previousRunDate.getTime() / 1000);
        const currentRunInSeconds = Math.floor(currentRunDate.getTime() / 1000);

        // Count period: [previousRun, currentRun - 1 second]
        const countFrom = previousRunInSeconds;
        const countUntil = currentRunInSeconds - 1;

        // Limit to current day
        const todayStartInSeconds = GetDayStartTimestampUTC(nowInSeconds);
        const endOfDayInSeconds = GetDayEndTimestampUTC(nowInSeconds);

        const finalCountFrom = Math.max(countFrom, todayStartInSeconds);
        const finalCountUntil = Math.min(countUntil, endOfDayInSeconds);

        // Count pingbacks by status in the previous execution period
        const counts = await CountPingbacksByStatus(
          this.monitor.tag,
          finalCountFrom,
          finalCountUntil
        );

        // Evaluate status based on counts
        const status = this.evaluatePingbackStatus(counts, upCount, degradedCount);

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
