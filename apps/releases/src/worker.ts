const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const EMBEDDING_DIMENSIONS = 1024;
const MAX_BODY_BYTES = 1024;
const MAX_QUERY_LENGTH = 240;

function jsonResponse(body: object, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function isQueryBody(value: unknown): value is { query: string } {
  if (typeof value !== "object" || value === null || !("query" in value)) return false;
  return typeof value.query === "string";
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/search-embedding") return env.ASSETS.fetch(request);

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
    }

    const fetchSite = request.headers.get("Sec-Fetch-Site");
    const origin = request.headers.get("Origin");
    if (fetchSite === "cross-site" || (origin && origin !== url.origin)) {
      return jsonResponse({ error: "Cross-origin requests are not allowed" }, 403);
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return jsonResponse({ error: "Content-Type must be application/json" }, 415);
    }
    const contentLength = Number(request.headers.get("Content-Length"));
    if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request body is missing or too large" }, 413);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON" }, 400);
    }
    if (!isQueryBody(body)) return jsonResponse({ error: "query must be a string" }, 400);

    const query = body.query.trim();
    if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
      return jsonResponse({ error: `query must be between 2 and ${MAX_QUERY_LENGTH} characters` }, 400);
    }

    // This is a low-traffic site, but the endpoint is unauthenticated and
    // bills real Workers AI usage per call - a per-IP cap keeps a stray bot
    // or repeated refresh from running up a real bill. Keyed by
    // CF-Connecting-IP (Cloudflare's own trusted client-IP header, not
    // spoofable by the request); requests with no such header (only
    // possible outside Cloudflare's network, e.g. local dev) share one
    // fallback bucket rather than bypassing the limit entirely.
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rateLimit = await env.SEARCH_EMBEDDING_RATE_LIMITER.limit({ key: clientIp });
    if (!rateLimit.success) {
      return jsonResponse({ error: "Too many search requests - please slow down" }, 429, { "Retry-After": "60" });
    }

    try {
      const result = await env.AI.run(EMBEDDING_MODEL, { queries: [query] });
      const vector = result.data?.[0];
      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
        console.error(JSON.stringify({ message: "Workers AI returned an invalid search embedding", path: url.pathname }));
        return jsonResponse({ error: "Semantic search is temporarily unavailable" }, 503);
      }
      return jsonResponse({ model: EMBEDDING_MODEL, vector });
    } catch (error) {
      console.error(JSON.stringify({
        message: "Search query embedding failed",
        error: error instanceof Error ? error.message : String(error),
        path: url.pathname,
      }));
      return jsonResponse({ error: "Semantic search is temporarily unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
