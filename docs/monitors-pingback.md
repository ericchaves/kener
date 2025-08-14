---
title: Pingback Monitors | Kener
description: Monitor services that send periodic signals (pingbacks) to Kener.
---

# Pingback Monitors

Pingback monitors are designed for services that actively report their status to Kener, instead of Kener polling them. 
Services are expected to send a number of signals by calling a pingback URL within a given time window to report they are up and running.
Kener evaluates the number of signals received within this time span depending on the window mode.

**Important:** Pingback counts are never accumulated across different days. Counts are reset at the end of each day, and when a new day begins, the service will be reported with the default status until pingbacks are received and counted again within the new day's time window.

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

In `sliding` mode, Kener will count the number of pingbacks received between the last execution and now (within the current day only).
If the pingback count is equal to or greater than `UP count`, the service is considered up and healthy.
If the pingback count is lower than `UP count` but greater than or equal to `DEGRADED count`, the service is considered degraded.
If the pingback count is lower than `DEGRADED count`, the service is considered down.

### Fixed window mode

In `fixed` mode, Kener counts pingbacks received from the `time window start` until the current execution time, but only until the end of the current day.

When the monitor executes before `time window end`, pingbacks are not counted and the monitor's default status is used to report the service status.

When the monitor executes after `time window end`, pingbacks are counted from `time window start` until now (limited to the end of the current day).
If the pingback count is equal to or greater than `UP count`, the service is considered up and healthy.
If the pingback count is lower than `UP count` but greater than or equal to `DEGRADED count`, the service is considered degraded.
If the pingback count is lower than `DEGRADED count`, the service is considered down.

### Dynamic window mode

In `dynamic` mode, you must define an eval function that will be invoked each time you call the `pingback` to determine the status of the signal (either UP, DOWN, or DEGRADED).
When the monitor executes, it will assume the status value of the last pingback invocation.

The eval function receives a `request` argument with the `method`, `headers`, `query` (query strings), and `body` properties.

## Pingback URL

The URL composed of the monitor's tag and a random string used to receive pingback signals. The URL accepts `GET` and `POST` methods only.

**Pingback Endpoint Example:**
`YOUR_KENER_URL/api/pingback/[monitor_tag]:[secret_string]`
