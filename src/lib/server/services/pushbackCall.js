// @ts-nocheck
import { UP, DOWN, DEGRADED, REALTIME, TIMEOUT, ERROR, MANUAL, NO_DATA } from "../constants.js";
import { GetNowTimestampUTC } from "../tool.js";
import { GetLastHeartbeat, CountPushbacks } from "../controllers/controller.js";

class PushbackCall {
  monitor;

  constructor(monitor) {
    this.monitor = monitor;
  }

  async execute() {
    try {
      let latestData = await GetLastHeartbeat(this.monitor.tag);
      if (!latestData) {
        return {
          status: NO_DATA,
          latency: 0,
        };
      }

      const { expected, minimum, startTime, endTime } = this.monitor.type_data;
      const nowInSeconds = GetNowTimestampUTC();

      let startDate = new Date();
      startDate.setHours(parseInt(startTime.split(":")[0]));
      startDate.setMinutes(parseInt(startTime.split(":")[1]));
      startDate.setSeconds(0);

      let endDate = new Date();
      endDate.setHours(parseInt(endTime.split(":")[0]));
      endDate.setMinutes(parseInt(endTime.split(":")[1]));
      endDate.setSeconds(0);

      const currentDate = new Date();
      if (currentDate <= endDate) {
        return {
          status: UP,
          latency: 0,
        };
      }

      const previousInSeconds = Math.floor(startDate.getTime() / 1000);
      const heartbeats = await CountPushbacks(this.monitor.tag, previousInSeconds, nowInSeconds);

      if (heartbeats >= expected) {
        return {
          status: UP,
          latency: 0,
        };
      }
      if (heartbeats >= minimum && heartbeats < expected) {
        return {
          status: DEGRADED,
          latency: 0,
        };
      }
      return {
        status: DOWN,
        latency: 0,
      };
    } catch (err) {
      console.error(`Error in PushbackCall ${this.monitor.tag}`, err);
      return {
        status: DOWN,
        latency: 0,
        type: ERROR,
      };
    }
  }

}

export default PushbackCall;


