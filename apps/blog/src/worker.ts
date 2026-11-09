const EMBEDDING_MODEL = "embeddinggemma-2";
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_ENDPOINT = "https://dowser.rpgm.tools/v1/embeddings";
// embeddinggemma-2 is trained with task prefixes; the generator uses the
// matching document prefix for the committed vectors.
const QUERY_PREFIX = "task: search result | query: ";
const EMBEDDING_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1024;
const MAX_QUERY_LENGTH = 240;
// A query's vector never changes for a given model, so repeat searches are
// answered from the edge cache for a day.
const CACHE_TTL_SECONDS = 86_400;

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

function readVector(value: unknown): number[] | null {
  if (typeof value !== "object" || value === null || !("data" in value) || !Array.isArray(value.data)) return null;
  const first: unknown = value.data[0];
  if (typeof first !== "object" || first === null || !("embedding" in first)) return null;
  const vector = first.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) return null;
  return vector.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)) ? vector : null;
}

// Workers expose a per-site cache as caches.default, which the DOM typings do
// not declare.
function workersCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

// The cache key holds only a hash of the query text and the model name, so a
// model change starts a fresh cache.
async function queryCacheKey(origin: string, query: string): Promise<Request> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(query));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`${origin}/api/search-embedding/cache/${EMBEDDING_MODEL}/${hash}`);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
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

    const query = body.query.trim().replace(/\s+/g, " ");
    if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
      return jsonResponse({ error: `query must be between 2 and ${MAX_QUERY_LENGTH} characters` }, 400);
    }

    // A cache hit costs Cogitator nothing, so it is answered before the rate
    // limiter and does not use up the visitor's budget.
    const cache = workersCache();
    const cacheKey = await queryCacheKey(url.origin, query);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const stored: unknown = await cached.json();
      if (typeof stored === "object" && stored !== null) {
        return jsonResponse(stored, 200, { "X-Search-Cache": "hit" });
      }
    }

    // This is a low-traffic site, but the endpoint is unauthenticated and
    // every call reaches Cogitator on a home machine - a per-IP cap keeps a
    // stray bot or repeated refresh from loading it. Keyed by
    // CF-Connecting-IP (Cloudflare's own trusted client-IP header, not
    // spoofable by the request); requests with no such header (only
    // possible outside Cloudflare's network, e.g. local dev) share one
    // fallback bucket rather than bypassing the limit entirely.
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rateLimit = await env.SEARCH_EMBEDDING_RATE_LIMITER.limit({ key: clientIp });
    if (!rateLimit.success) {
      return jsonResponse({ error: "Too many search requests - please slow down" }, 429, { "Retry-After": "60" });
    }

    // Any failure here (Cogitator down, Access refusing, a timeout, a bad
    // body) answers 503, and the page then falls back to keyword search.
    try {
      const upstream = await fetch(EMBEDDING_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": env.PRESS_SEARCH_ACCESS_ID,
          "CF-Access-Client-Secret": env.PRESS_SEARCH_ACCESS_SECRET,
          Authorization: `Bearer ${env.COGITATOR_EMBED_KEY}`,
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: `${QUERY_PREFIX}${query}` }),
        signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      });
      if (upstream.status !== 200) {
        console.error(JSON.stringify({ message: "Cogitator refused the search embedding", status: upstream.status, path: url.pathname }));
        return jsonResponse({ error: "Semantic search is temporarily unavailable" }, 503);
      }
      const result: unknown = await upstream.json();
      const vector = readVector(result);
      if (!vector) {
        console.error(JSON.stringify({ message: "Cogitator returned an invalid search embedding", path: url.pathname }));
        return jsonResponse({ error: "Semantic search is temporarily unavailable" }, 503);
      }
      const payload = { model: EMBEDDING_MODEL, vector };
      ctx.waitUntil(cache.put(cacheKey, Response.json(payload, {
        headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
      })));
      return jsonResponse(payload, 200, { "X-Search-Cache": "miss" });
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
