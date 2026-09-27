/**
 * Drafts review API. The whole hostname sits behind Cloudflare Access, and
 * workers.dev and preview URLs are off, so every request that reaches this
 * Worker has already passed Access. The header check below is a second line
 * in case a route is ever added without it.
 *
 *   POST /api/review   queue a review action from the drafts site
 *   GET  /api/status   the newest action on a draft's current revision
 *
 * The local drafter drains the queue through D1 directly (wrangler d1
 * execute), so it never needs a route here or an Access service token.
 */

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Local testing only: `wrangler dev --var ALLOW_NO_ACCESS:1`. Never set in wrangler.jsonc. */
  ALLOW_NO_ACCESS?: string;
}

const ACTIONS = new Set(["revise", "approve", "kill", "park", "cover"]);
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const MAX_BODY_BYTES = 64 * 1024;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "Request body too large" }, 413);
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    return json({ error: "Body must be a JSON object" }, 400);
  }
}

async function review(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin requests are not allowed" }, 403);
  const body = await readBody(request);
  if (body instanceof Response) return body;

  const { slug, revision, action } = body;
  if (typeof slug !== "string" || !SLUG.test(slug)) return json({ error: "Invalid slug" }, 400);
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) return json({ error: "Invalid revision" }, 400);
  if (typeof action !== "string" || !ACTIONS.has(action)) return json({ error: "Unknown action" }, 400);

  const payload = {
    notes: typeof body.notes === "string" ? body.notes : "",
    inline: Array.isArray(body.inline) ? body.inline : [],
    rating: typeof body.rating === "number" ? body.rating : null,
    reasons: Array.isArray(body.reasons) ? body.reasons : [],
    by: request.headers.get("Cf-Access-Authenticated-User-Email") ?? null,
  };
  const row = await env.DB.prepare("INSERT INTO actions (slug, revision, action, payload) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(slug, revision, action, JSON.stringify(payload))
    .first<{ id: number }>();
  return json({ id: row?.id }, 201);
}

async function status(url: URL, env: Env): Promise<Response> {
  const slug = url.searchParams.get("slug") ?? "";
  const revision = Number(url.searchParams.get("revision") ?? "1");
  if (!SLUG.test(slug)) return json({ error: "Invalid slug" }, 400);
  if (!Number.isInteger(revision) || revision < 1) return json({ error: "Invalid revision" }, 400);
  // The newest request made on this revision or a later one, whatever its state.
  const latest = await env.DB.prepare(
    "SELECT id, action, status, created_at, done_at, result FROM actions WHERE slug = ? AND revision >= ? ORDER BY id DESC LIMIT 1",
  )
    .bind(slug, revision)
    .first();
  return json({ latest: latest ?? null });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!request.headers.get("Cf-Access-Jwt-Assertion") && env.ALLOW_NO_ACCESS !== "1") return json({ error: "Forbidden" }, 403);

    const route = `${request.method} ${url.pathname}`;
    switch (route) {
      case "POST /api/review":
        return review(request, env);
      case "GET /api/status":
        return status(url, env);
      default:
        return json({ error: "Not found" }, 404);
    }
  },
} satisfies ExportedHandler<Env>;
