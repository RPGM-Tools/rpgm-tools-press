const EMBEDDING_ENDPOINT = "https://dowser.rpgm.tools/v1/embeddings";
const EMBEDDING_MODEL = "embeddinggemma-2";
const EMBEDDING_DIMENSIONS = 768;
const QUERY_PREFIX = "task: search result | query: ";
const PROBE_QUERY = "search outage probe";
const CRESSET_EVENTS_URL = "https://cresset.rpgm.tools/v1/events";
const REQUEST_TIMEOUT_MS = 10_000;
const EVIDENCE_LIMIT = 1_000;
const RETRY_DELAYS_MS = [5_000, 15_000];

const SITES = [
  { host: "blog.rpgm.tools", name: "Blog" },
  { host: "releases.rpgm.tools", name: "The Ledger" },
] as const;

type Site = (typeof SITES)[number];

interface CheckResult {
  ok: boolean;
  detail: string;
}

interface Incident {
  host: string;
  className: string;
  title: string;
  description: string;
  nextStep: string;
  reproduce: string;
  evidence: string;
  site: Site;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function hasVector(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("data" in value) || !Array.isArray(value.data)) return false;
  const first: unknown = value.data[0];
  if (typeof first !== "object" || first === null || !("embedding" in first)) return false;
  const vector = first.embedding;
  return Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS && vector.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

// Asks Cogitator for one embedding the way the site Workers do. Their own
// reads are mostly answered from KV, so this is the check that notices
// Cogitator or Access failing.
async function checkCogitator(env: Env): Promise<CheckResult> {
  let result = await checkCogitatorOnce(env);
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await checkCogitatorOnce(env);
  }
  return result;
}

async function checkCogitatorOnce(env: Env): Promise<CheckResult> {
  try {
    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": env.PRESS_SEARCH_ACCESS_ID,
        "CF-Access-Client-Secret": env.PRESS_SEARCH_ACCESS_SECRET,
        Authorization: `Bearer ${env.COGITATOR_EMBED_KEY}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: `${QUERY_PREFIX}${PROBE_QUERY}` }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status !== 200) return { ok: false, detail: `Cogitator answered ${response.status}` };
    const body: unknown = await response.json();
    return hasVector(body) ? { ok: true, detail: "ok" } : { ok: false, detail: "Cogitator answered 200 with a malformed embedding" };
  } catch (error) {
    return { ok: false, detail: `Cogitator request failed: ${describeError(error)}` };
  }
}

// The probe query is stored after its first answer, so this mostly exercises
// the Worker and its KV read, not Cogitator.
async function checkSiteRoute(site: Site): Promise<CheckResult> {
  try {
    const response = await fetch(`https://${site.host}/api/search-embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: PROBE_QUERY }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.status === 200
      ? { ok: true, detail: "ok" }
      : { ok: false, detail: `${site.host}/api/search-embedding answered ${response.status}` };
  } catch (error) {
    return { ok: false, detail: `${site.host}/api/search-embedding request failed: ${describeError(error)}` };
  }
}

async function sendIncident(env: Env, incident: Incident): Promise<void> {
  const payload = {
    host: incident.host,
    component: "search-embedding",
    class: incident.className,
    severity: "warning",
    title: incident.title,
    description: incident.description,
    assessment: "real",
    origin: "press-probe cron",
    next_step: incident.nextStep,
    reproduce: incident.reproduce,
    runbook: "https://github.com/RPGM-Tools/rpgm-tools-press",
    evidence_tail: incident.evidence.slice(0, EVIDENCE_LIMIT),
    related: [{ label: incident.site.name, url: `https://${incident.site.host}` }],
    scope: "owner",
  };
  try {
    const response = await fetch(CRESSET_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CRESSET_PRESS_PROBE_TOKEN}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ message: "Cresset refused the search probe event", status: response.status, host: incident.host, class: incident.className }));
    }
  } catch (error) {
    console.error(JSON.stringify({ message: "Cresset could not be reached", error: describeError(error), host: incident.host }));
  }
}

// Cresset counts repeats of an active incident instead of paging again, so a
// failing check posts on every run.
export async function runProbe(env: Env): Promise<{ checks: Record<string, string> }> {
  const [cogitator, ...routes] = await Promise.all([checkCogitator(env), ...SITES.map(checkSiteRoute)]);
  const checks: Record<string, string> = { cogitator: cogitator.detail };
  const incidents: Incident[] = [];

  SITES.forEach((site, index) => {
    const route = routes[index];
    if (!route) return;
    checks[site.host] = route.detail;
    if (!cogitator.ok) {
      incidents.push({
        host: site.host,
        className: "cogitator_down",
        title: "Press search is on keyword fallback",
        description: `Cogitator did not return a search embedding, so ${site.host} answers new searches with keyword results only.`,
        nextStep: "Check Cogitator on bilbo and the dowser.rpgm.tools tunnel and Access policy.",
        reproduce: "curl -i -X POST https://dowser.rpgm.tools/v1/embeddings",
        evidence: cogitator.detail,
        site,
      });
    } else if (!route.ok) {
      incidents.push({
        host: site.host,
        className: "route_error",
        title: "Press search route is failing",
        description: `${site.host}/api/search-embedding did not answer 200 although Cogitator is healthy.`,
        nextStep: "Check the latest deploy of the site Worker and its KV namespace binding.",
        reproduce: `curl -i -X POST https://${site.host}/api/search-embedding -H 'Content-Type: application/json' -d '{"query":"${PROBE_QUERY}"}'`,
        evidence: route.detail,
        site,
      });
    }
  });

  await Promise.all(incidents.map((incident) => sendIncident(env, incident)));
  if (incidents.length > 0) console.error(JSON.stringify({ message: "Search probe raised incidents", incidents: incidents.length, checks }));
  return { checks };
}

export default {
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(runProbe(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
