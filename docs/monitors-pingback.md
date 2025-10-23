---
title: Pingback Monitors | Kener
description: Monitor services that send periodic signals (pingbacks) to Kener.
---

# Pingback Monitors

Pingback monitors are designed for services that actively report their status to Kener, instead of Kener polling them.
Services can send signals with status UP, DOWN, or DEGRADED by calling a pingback URL.
Kener evaluates the number of signals received within this time span depending on the window mode.

**Important:** Pingback counts are never accumulated across different days. Counts are reset at the end of each day, and when a new day begins, the service will be reported with the default status until pingbacks are received and counted again within the new day's time window.

**How pingbacks are counted:**
- Pingbacks are counted separately by status: UP, DOWN, and DEGRADED.
- The monitor evaluates the count of each status type to determine the final service status.
- UP pingbacks count towards both `UP count` threshold and `DEGRADED count` threshold (fallback behavior).
- DEGRADED pingbacks count only towards `DEGRADED count` threshold.
- DOWN pingbacks are tracked but do not contribute to any threshold.

<div class="border rounded-md">

![Monitors Pingback](/documentation/m_pingback.png)

</div>

## Schedule (Cron Expression)

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

This is a standard cron expression that defines how often Kener will run this monitor check. For example, `*/5 * * * *` means the check will run every 5 minutes.

## Window Mode

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

### Sliding window mode

In `sliding` mode, Kener counts pingbacks received during the **previous cron execution period** only (within the current day). For example, if the cron runs every 10 minutes, at 08:10 it counts pingbacks from 08:00-08:09, at 08:20 it counts pingbacks from 08:10-08:19, and so on.

**Status Evaluation Logic:**
1. If `UP count >= upCount` → service is **UP**
2. Else, if `DEGRADED count > 0`:
   - If `DEGRADED count >= degradedCount` → service is **DEGRADED**
   - Else, if `UP count >= degradedCount` → service is **DEGRADED** (fallback: not enough UPs for UP status, but enough for DEGRADED)
   - Else → service is **DOWN**
3. Else (when `DEGRADED count = 0`) → service is **DOWN**

**Binary Mode (DEGRADED count = 0):**
When `DEGRADED count` is set to 0, the monitor operates in binary mode, returning only **UP** or **DOWN** status. The DEGRADED status is never returned.

**Example Evaluation Table:**

| UP Count Threshold | DEGRADED Count Threshold | UP Pingbacks | DEGRADED Pingbacks | DOWN Pingbacks | Final Status | Reason |
|-------------------|-------------------------|--------------|-------------------|----------------|--------------|---------|
| 10 | 5 | 15 | 2 | 1 | UP | UP count (15) >= threshold (10) |
| 10 | 5 | 8 | 6 | 1 | DEGRADED | DEGRADED count (6) >= threshold (5) |
| 10 | 5 | 7 | 2 | 1 | DEGRADED | UP count (7) >= degradedCount (5) |
| 10 | 5 | 3 | 2 | 5 | DOWN | Neither threshold met |
| 10 | 0 | 15 | 0 | 0 | UP | UP count (15) >= threshold (10) |
| 10 | 0 | 7 | 3 | 2 | DOWN | Binary mode: UP count (7) < threshold (10) |

### Fixed window mode

In `fixed` mode, Kener counts all pingbacks (UP, DOWN, DEGRADED) received from the `time window start` until the current execution time, limited to the end of the current day. Pingbacks received before the time window start are not counted.

**Monitor behavior based on execution time:**

1. **Before time window start**: The monitor returns the default status without counting pingbacks.

2. **Between time window start and end**: Pingbacks are counted from `time window start` until now.
   - If `UP count >= upCount` → service is **UP**
   - Otherwise, the monitor returns the default status. The service is **not** marked as DEGRADED or DOWN during this period.

3. **After time window end**: Pingbacks are counted from `time window start` until now (limited to the end of the current day). The same evaluation logic as SLIDING mode applies:
   - If `UP count >= upCount` → service is **UP**
   - Else, if `DEGRADED count > 0`:
     - If `DEGRADED count >= degradedCount` → service is **DEGRADED**
     - Else, if `UP count >= degradedCount` → service is **DEGRADED** (fallback)
     - Else → service is **DOWN**
   - Else (when `DEGRADED count = 0`) → service is **DOWN**

**Binary Mode (DEGRADED count = 0):**
When `DEGRADED count` is set to 0, the monitor operates in binary mode, returning only **UP** or **DOWN** status after the time window end. The DEGRADED status is never returned.

**Cron expression requirements for FIXED mode:**
- The cron expression must schedule at least one execution **during** the time window (between start and end).
- The cron expression must schedule at least one execution **after** the time window end on the same day.

### Cumulative window mode

In `cumulative` mode, Kener counts all pingbacks (UP, DOWN, DEGRADED) received from the **start of the current day (00:00)** until the current execution time. This is an accumulative count that grows throughout the day and resets at midnight.

**Status Evaluation Logic:**
Uses the same evaluation logic as SLIDING and FIXED (after window end) modes:
1. If `UP count >= upCount` → service is **UP**
2. Else, if `DEGRADED count > 0`:
   - If `DEGRADED count >= degradedCount` → service is **DEGRADED**
   - Else, if `UP count >= degradedCount` → service is **DEGRADED** (fallback)
   - Else → service is **DOWN**
3. Else (when `DEGRADED count = 0`) → service is **DOWN**

**Binary Mode (DEGRADED count = 0):**
When `DEGRADED count` is set to 0, the monitor operates in binary mode, returning only **UP** or **DOWN** status. The DEGRADED status is never returned.

**Example behavior:**
```
Day: 2025-10-24, upCount=10, degradedCount=5, cron runs every hour

08:00 - Received 3 UP, 1 DEGRADED → Counts: UP=3, DEGRADED=1 → Status: DOWN
09:00 - Received 4 UP, 2 DEGRADED → Counts: UP=7, DEGRADED=3 → Status: DEGRADED (UP >= degradedCount)
10:00 - Received 5 UP, 1 DEGRADED → Counts: UP=12, DEGRADED=4 → Status: UP (UP >= upCount)
11:00 - Received 2 UP, 0 DEGRADED → Counts: UP=14, DEGRADED=4 → Status: UP

Next day 00:00 - Counts reset to 0
```

### Dynamic window mode

In `dynamic` mode, you must define an eval function that will be invoked each time you call the `pingback` to determine the status of the signal (either UP, DOWN, or DEGRADED).
When the monitor executes, it will assume the status value of the last pingback invocation from the current day.

If the last pingback was from a previous day, the monitor returns the default status.

The eval function receives a `request` argument with the `method`, `headers`, `query` (query strings), and `body` properties.

**Timeout Configuration (Required):**

- `timeout`: Maximum acceptable latency in milliseconds. If exceeded, the service is considered DOWN. Must be a positive number.
- `degradedTimeout`: Latency threshold in milliseconds. If exceeded (but below timeout), the service is considered DEGRADED.
  - Set to `0` to disable DEGRADED status (binary mode: only UP or DOWN).
  - If greater than 0, must be less than `timeout`.

**Latency Evaluation:**

When the eval function returns status UP with a non-zero latency, the latency is evaluated against the timeout thresholds:

- If `latency >= timeout`: final status is **DOWN**
- If `degradedTimeout > 0` and `degradedTimeout <= latency < timeout`: final status is **DEGRADED**
- If `latency < degradedTimeout` or `degradedTimeout = 0`: final status remains **UP**
- If `latency = 0`: timeout rules are ignored and status remains as returned by eval

When the eval function returns status DOWN or DEGRADED, the latency is not evaluated and the returned status is used directly.

**Binary Mode (degradedTimeout = 0):**
When `degradedTimeout` is set to 0, the monitor operates in binary mode for latency evaluation. Only **UP** or **DOWN** status will be returned based on latency. The DEGRADED status is never returned from latency evaluation.

**Example Evaluation Table:**

| Timeout | DEGRADED Timeout | Latency | Status |
|---------|------------------|---------|--------|
| 1000 | 500 | 200 | UP |
| 1000 | 500 | 700 | DEGRADED |
| 1000 | 500 | 1200 | DOWN |
| 1000 | 0 | 200 | UP (binary mode) |
| 1000 | 0 | 700 | UP (binary mode) |
| 1000 | 0 | 1200 | DOWN (binary mode) |
| 1000 | 500 | 0 | UP (ignores timeouts) |

**Important considerations for the eval function:**

- The eval function **must always be declared as an async function**.
- If the eval function throws an exception, the pingback will be automatically registered with status DOWN.
- The latency value returned by the eval function is always stored as a positive number. Negative values are converted to their absolute value.
- To ignore latency-based status evaluation, return `latency: 0`.

**Eval function example:**
```javascript
async (req, default_status) => {
  const startTime = Date.now();
  
  // Check health status
  if (req.body?.health !== 'ok') {
    // Return DOWN without latency evaluation
    return { status: 'DOWN', latency: 0 };
  }

  // Simulate processing time
  const processingTime = Date.now() - startTime;
  
  // Check body content
  if (req.body?.health === 'ok') {
    // Return UP with latency for timeout evaluation
    return { status: 'UP', latency: req.body.response_time || processingTime };
  }
  
  // Return DEGRADED without latency evaluation
  return { status: 'DEGRADED', latency: 0 };
}
```
