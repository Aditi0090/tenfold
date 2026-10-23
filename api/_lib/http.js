/** Small helpers shared by every /api function (Web-standard Request/Response). */

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Base URL of the site, used for Stripe redirect URLs. */
export function siteOrigin(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = request.headers;
  if (h.get('origin')) return h.get('origin');
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/** Wrap a handler so unexpected errors become clean JSON 500s. */
export function safe(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      console.error(err);
      return fail(err?.message || 'Unexpected server error', err?.status || 500);
    }
  };
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
