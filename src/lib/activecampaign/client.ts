import "server-only";

// Minimal ActiveCampaign API v3 client.
// Docs: https://developers.activecampaign.com/reference
// AC allows 5 requests/second per account, so every call goes through a shared limiter.

const MIN_INTERVAL_MS = 220;
const MAX_RETRIES = 4;

let nextSlot = 0;

async function waitForSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

export function acConfig(): { baseUrl: string; apiKey: string; appUrl: string } | null {
  const rawUrl = process.env.AC_API_URL?.trim();
  const apiKey = process.env.AC_API_KEY?.trim();
  if (!rawUrl || !apiKey) return null;
  const baseUrl = rawUrl.replace(/\/+$/, "").replace(/\/api\/3$/, "");
  return { baseUrl, apiKey, appUrl: acAppUrl(baseUrl) };
}

// https://cuenta.api-us1.com -> https://cuenta.activehosted.com (overridable with AC_APP_URL).
function acAppUrl(baseUrl: string): string {
  const override = process.env.AC_APP_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  try {
    const account = new URL(baseUrl).hostname.split(".")[0];
    return `https://${account}.activehosted.com`;
  } catch {
    return baseUrl;
  }
}

export class AcError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function acGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const config = acConfig();
  if (!config) throw new AcError("ActiveCampaign no está configurado (AC_API_URL / AC_API_KEY).", 0);

  const url = new URL(`${config.baseUrl}/api/3${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  for (let attempt = 0; ; attempt++) {
    await waitForSlot();
    const res = await fetch(url, {
      headers: { "Api-Token": config.apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new AcError(`ActiveCampaign ${res.status} en ${path}: ${body.slice(0, 200)}`, res.status);
  }
}

// Fetches every page of a list endpoint. Only use for small collections (pipelines, stages, users, fields).
export async function acGetAll<T>(
  path: string,
  key: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T[]> {
  const limit = 100;
  const all: T[] = [];
  for (let offset = 0; ; offset += limit) {
    const page = await acGet<Record<string, unknown>>(path, { ...params, limit, offset });
    const items = (page[key] as T[] | undefined) ?? [];
    all.push(...items);
    if (items.length < limit) return all;
  }
}
