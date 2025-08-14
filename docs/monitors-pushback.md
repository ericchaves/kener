---
title: Pushback Monitors | Kener
description: Monitor services that send periodic signals (pushbacks) to Kener.
---

# Pushback Monitors

Pushback monitors are designed for services that actively report their status to Kener, instead of Kener polling them. This is useful for internal services or applications that should send a number of signals within a given time span to indicate they are up and running. Kener evaluates the number of signals received within a defined period, but only after a specified end time.

<div class="border rounded-md">

![Monitors Pushback](/documentation/m_pushback.png)

</div>

## Schedule (Cron Expression)

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

This is a standard cron expression that defines how often Kener will run this monitor check. For example, `*/5 * * * *` means the check will run every 5 minutes.

## Expected Signals

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

This is the number of signals (pushbacks) that Kener *expects* to receive from your service within the counting interval (from `startTime` to the current time, evaluated after `endTime`). If the actual number of received signals is equal to or greater than this value, the monitor will be marked as `UP`.

## Minimum Signals

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

This is the minimum number of signals (pushbacks) that Kener considers acceptable within the counting interval. If the number of received signals is greater than or equal to this value but less than `Expected Signals`, the monitor will be marked as `DEGRADED`.

## Start Time

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

A time string in the format `HH:mm` (e.g., `08:00`) that defines the start of the counting interval for signals. The monitor will only evaluate the number of signals received after `endTime`, counting from this `startTime`.

## End Time

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

A time string in the format `HH:mm` (e.g., `18:00`) that defines when Kener starts evaluating the number of signals received. If the check is run at or before this time, the monitor status is automatically `UP`. After this time, Kener counts signals received since `startTime` to determine the status.

## Secret String

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

A secret string used to authenticate the pushback signal sent to Kener. This ensures that only authorized services can report their status. The service sending the pushback must include this secret string in its request to Kener's pushback endpoint.

**Pushback Endpoint Example:**
`YOUR_KENER_URL/api/pushback/[monitor_tag]:[secret_string]`

Replace `[monitor_tag]` with your monitor's tag and `[secret_string]` with the secret string configured here.

## Status Determination

The Pushback monitor's status is determined as follows:

- **Before or at `endTime` (including before `startTime`)**: The monitor is marked as `UP`, regardless of the number of signals received.
- **After `endTime`**:
  - **UP**: If the number of received signals since `startTime` is greater than or equal to the `Expected Signals`.
  - **DEGRADED**: If the number of received signals since `startTime` is greater than or equal to the `Minimum Signals` but less than the `Expected Signals`.
  - **DOWN**: If the number of received signals since `startTime` is less than the `Minimum Signals`.
- **NO_DATA**: If no signals have been received for this monitor yet.
- **DOWN (with ERROR)**: If an error occurs during the execution of the monitor check.

## Additional Notes

Ensure your external service is configured to send periodic HTTP GET or POST requests to Kener's pushback endpoint with the correct monitor tag and secret string. The frequency of these requests should align with your monitor's configuration to meet the `Expected Signals` threshold within the counting interval (from `startTime` to the current time, evaluated after `endTime`). Note that signal counting only occurs after `endTime`, so signals sent before `startTime` or after `endTime` may not affect the status unless the monitor is checked after `endTime`.
