// @ts-nocheck
// @ts-ignore
import { json, text } from "@sveltejs/kit";
import { RegisterPingback } from "$lib/server/controllers/controller";


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
export async function GET({ request, params }) {
  let signal = params.signal;
  let signalData = signal.split(":");
  if (signalData.length != 2) {
    return json({ error: "Invalid url" }, { status: 400 });
  }
  const req = await parseRequest(request, params);
  let resp = await RegisterPingback(signalData[0], signalData[1], req);
  if (!!!resp) {
    return json({ error: "Invalid pingback url" }, { status: 400 });
  }
  return json(
    { status: "OK" },
    {
      status: 200,
    },
  );
}

export async function POST({ request, params }) {
  let signal = params.signal;
  let signalData = signal.split(":");
  if (signalData.length != 2) {
    return json({ error: "Invalid url" }, { status: 400 });
  }
  const req = await parseRequest(request, params);
  let resp = await RegisterPingback(signalData[0], signalData[1], req);
  if (!!!resp) {
    return json({ error: "Invalid pingback url" }, { status: 400 });
  }
  return json(
    { status: "OK" },
    {
      status: 200,
    },
  );
}
