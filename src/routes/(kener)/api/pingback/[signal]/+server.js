// @ts-nocheck
// @ts-ignore
import { json, text } from "@sveltejs/kit";
import { RegisterPingback } from "$lib/server/controllers/controller";
import { GetNowTimestampUTC } from "$lib/server/tool";


async function parseRequest(request, params = {}) {
  // method
  const method = request.method;

  // Headers
  const headers = Object.fromEntries(request.headers.entries());

  // Query strings (search params)
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  // Detecta o tipo de conteúdo
  const contentType = request.headers.get('content-type');
  let body = null;

  if (contentType?.includes('application/json')) {
    body = await request.json();
  } else if (contentType?.includes('multipart/form-data') ||
             contentType?.includes('application/x-www-form-urlencoded')) {
    body = await request.formData();
  } else if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  return { method, headers, query, body };
}

/**
 * Maps error codes to HTTP status codes
 */
function getHttpStatusForError(errorCode) {
  const statusMap = {
    // 400 - Bad Request
    'EVAL_EXECUTION_FAILED': 400,
    'EVAL_INVALID_STATUS': 400,
    'INVALID_REQUEST_STATUS': 400,
    'INVALID_URL_FORMAT': 400,

    // 401 - Unauthorized
    'INVALID_SECRET': 401,

    // 404 - Not Found
    'MONITOR_NOT_FOUND': 404,

    // 500 - Internal Server Error
    'MONITOR_CONFIG_MISSING': 500,
    'MONITOR_CONFIG_INVALID': 500,
    'DATABASE_INSERT_FAILED': 500,
    'INTERNAL_SERVER_ERROR': 500,
    'UNKNOWN_ERROR': 500,
  };

  return statusMap[errorCode] || 500;
}

export async function GET({ request, params }) {
  let signal = params.signal;
  let signalData = signal.split(":");

  if (signalData.length != 2) {
    return json({
      error: {
        code: "INVALID_URL_FORMAT",
        message: "Invalid pingback URL format"
      },
      timestamp: GetNowTimestampUTC()
    }, { status: 400 });
  }

  const req = await parseRequest(request, params);
  let resp = await RegisterPingback(signalData[0], signalData[1], req);

  if (!resp) {
    // Should never happen (catch-all returns object)
    return json({
      error: {
        code: "UNKNOWN_ERROR",
        message: "Unknown error occurred"
      },
      timestamp: GetNowTimestampUTC()
    }, { status: 500 });
  }

  // Check if response is an error
  if (resp.error) {
    const statusCode = getHttpStatusForError(resp.error.code);
    return json(resp, { status: statusCode });
  }

  // Success
  return json(resp, { status: 200 });
}

export async function POST({ request, params }) {
  let signal = params.signal;
  let signalData = signal.split(":");

  if (signalData.length != 2) {
    return json({
      error: {
        code: "INVALID_URL_FORMAT",
        message: "Invalid pingback URL format"
      },
      timestamp: GetNowTimestampUTC()
    }, { status: 400 });
  }

  const req = await parseRequest(request, params);
  let resp = await RegisterPingback(signalData[0], signalData[1], req);

  if (!resp) {
    // Should never happen (catch-all returns object)
    return json({
      error: {
        code: "UNKNOWN_ERROR",
        message: "Unknown error occurred"
      },
      timestamp: GetNowTimestampUTC()
    }, { status: 500 });
  }

  // Check if response is an error
  if (resp.error) {
    const statusCode = getHttpStatusForError(resp.error.code);
    return json(resp, { status: statusCode });
  }

  // Success
  return json(resp, { status: 200 });
}
