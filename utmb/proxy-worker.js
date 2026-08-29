/**
 * UTMB Live relay — a Cloudflare Worker that forwards GET requests to the
 * UTMB Live API with the `X-Tenant` header it requires, and answers with
 * CORS headers so the tracker at clkruse.github.io/utmb can read it.
 *
 * Why: utmblive-api.utmb.world only sends Access-Control-Allow-Origin for
 * live.utmb.world, and no public CORS proxy forwards custom headers.
 *
 * Deploy (free tier is plenty; ~1 request/min/viewer):
 *   npx wrangler login                     # once; opens a browser
 *   npx wrangler deploy utmb/proxy-worker.js --name utmb-relay --compatibility-date 2026-01-01
 * Then set PROXY_DEFAULT in utmb/index.html to
 *   "https://utmb-relay.<your-subdomain>.workers.dev/?url="
 *
 * Usage:  GET https://<worker>/?url=<encoded upstream URL>   (header X-Tenant: utmb_2026)
 * Only the hosts below are proxied. Responses are cached at the edge for a
 * few seconds so many viewers share one upstream request.
 */

const ALLOWED_HOSTS = new Set([
  "utmblive-api.utmb.world",
  "livetrailv3.s3.gra.io.cloud.ovh.net",
]);
// Origins allowed to call the relay. Add your own if you fork this.
const ALLOWED_ORIGINS = [
  /^https:\/\/clkruse\.github\.io$/,
  /^https:\/\/(www\.)?calebkruse\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];
const DEFAULT_TENANT = "utmb_2026";
const EDGE_TTL_SECONDS = 10;

function corsHeaders(origin) {
  const ok = origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Tenant, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return new Response("GET only", { status: 405, headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    let upstream;
    try { upstream = new URL(target); } catch { return json({ error: "missing or invalid ?url=" }, 400, cors); }
    if (upstream.protocol !== "https:" || !ALLOWED_HOSTS.has(upstream.hostname)) {
      return json({ error: "host not allowed" }, 403, cors);
    }

    const tenant = request.headers.get("X-Tenant") || DEFAULT_TENANT;
    if (!/^[a-z0-9_-]{1,40}$/i.test(tenant)) return json({ error: "bad tenant" }, 400, cors);

    // Edge cache keyed on upstream URL + tenant, so a burst of viewers costs one upstream call.
    const cache = caches.default;
    const cacheKey = new Request(`https://relay-cache.invalid/${tenant}/${encodeURIComponent(upstream.href)}`);
    let res = await cache.match(cacheKey);
    if (!res) {
      const up = await fetch(upstream.href, {
        headers: {
          "X-Tenant": tenant,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "utmb-relay (github.com/clkruse)",
        },
      });
      const body = await up.arrayBuffer();
      res = new Response(body, {
        status: up.status,
        headers: {
          "Content-Type": up.headers.get("Content-Type") || "application/json",
          "Cache-Control": `public, max-age=${EDGE_TTL_SECONDS}`,
        },
      });
      if (up.ok) await cache.put(cacheKey, res.clone());
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
