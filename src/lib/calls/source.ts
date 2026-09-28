import "server-only";
import { readFile } from "node:fs/promises";
import { unstable_cache } from "next/cache";
import { SignJWT, importPKCS8 } from "jose";
import { parseWorkbook, type RawSheet } from "./parse";
import type { CallsDataset } from "./types";

export const CALLS_CACHE_TAG = "calls-sheet";
/** Cada cuántos segundos se vuelve a leer Google Sheets de forma automática. */
export const CALLS_REVALIDATE_SECONDS = 300;

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export class CallsConfigError extends Error {}

export function callsSourceConfigured(): boolean {
  return Boolean(
    process.env.CALLS_FIXTURE_PATH ||
      (process.env.CALLS_SHEET_ID &&
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  );
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // Netlify guarda los saltos de línea de la llave como "\n" literales.
  const pem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SHEETS_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new CallsConfigError(
      `Google rechazó la cuenta de servicio (${res.status}). Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL y la llave privada.`
    );
  }
  return (await res.json()).access_token;
}

async function fetchFromGoogle(): Promise<{ title: string; sheets: RawSheet[] }> {
  const id = process.env.CALLS_SHEET_ID!;
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;

  const metaRes = await fetch(`${base}?fields=properties.title,sheets.properties.title`, {
    headers,
    cache: "no-store",
  });
  if (!metaRes.ok) {
    throw new CallsConfigError(
      metaRes.status === 403 || metaRes.status === 404
        ? `No hay acceso a la hoja (${metaRes.status}). Compártela como Lector con ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}.`
        : `Error al leer la hoja (${metaRes.status}).`
    );
  }
  const meta = await metaRes.json();
  const titles: string[] = meta.sheets.map(
    (s: { properties: { title: string } }) => s.properties.title
  );

  const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE" });
  for (const t of titles) params.append("ranges", `'${t.replace(/'/g, "''")}'!A1:Z`);
  const valuesRes = await fetch(`${base}/values:batchGet?${params}`, {
    headers,
    cache: "no-store",
  });
  if (!valuesRes.ok) throw new CallsConfigError(`Error al leer los valores (${valuesRes.status}).`);
  const data = await valuesRes.json();

  return {
    title: meta.properties.title,
    sheets: titles.map((title, i) => ({
      title,
      values: data.valueRanges[i]?.values ?? [],
    })),
  };
}

/**
 * Solo para desarrollo local: un JSON `{ title, sheets: [{ title, values }] }` con el
 * mismo formato que devuelve Google. No lo subas al repositorio (contiene datos personales).
 */
async function fetchFromFixture(): Promise<{ title: string; sheets: RawSheet[] }> {
  return JSON.parse(await readFile(process.env.CALLS_FIXTURE_PATH!, "utf8"));
}

async function loadCallsUncached(): Promise<CallsDataset> {
  const useFixture = Boolean(process.env.CALLS_FIXTURE_PATH);
  const { title, sheets } = useFixture ? await fetchFromFixture() : await fetchFromGoogle();
  const { records, warnings } = parseWorkbook(sheets);
  return {
    records,
    warnings,
    sheetTitle: title,
    syncedAt: new Date().toISOString(),
    source: useFixture ? "fixture" : "google",
  };
}

export const loadCalls = unstable_cache(loadCallsUncached, ["calls-dataset"], {
  tags: [CALLS_CACHE_TAG],
  revalidate: CALLS_REVALIDATE_SECONDS,
});
