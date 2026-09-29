import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { parseWorkbook, type RawSheet } from "./parse";
import type { CallsDataset } from "./types";

type StoredUpload = {
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  sheets: RawSheet[];
};

const KEY = "latest";

// En Netlify se usa Netlify Blobs. En `next dev` (sin Netlify) se guarda en .data/ local.
const useLocalFile = process.env.NODE_ENV !== "production" && !process.env.NETLIFY;
const localPath = path.join(process.cwd(), ".data", "latest.json");

const store = () => getStore({ name: "campana-llamadas", consistency: "strong" });

export async function saveUpload(upload: StoredUpload) {
  if (useLocalFile) {
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, JSON.stringify(upload));
    return;
  }
  await store().setJSON(KEY, upload);
}

async function readUpload(): Promise<StoredUpload | null> {
  if (useLocalFile) {
    try {
      return JSON.parse(await readFile(localPath, "utf8"));
    } catch {
      return null;
    }
  }
  return (await store().get(KEY, { type: "json" })) ?? null;
}

/** Datos del último archivo subido, o null si todavía no se ha subido ninguno. */
export async function loadCalls(): Promise<CallsDataset | null> {
  const upload = await readUpload();
  if (!upload) return null;
  const { records, warnings } = parseWorkbook(upload.sheets);
  return {
    records,
    warnings,
    fileName: upload.fileName,
    uploadedAt: upload.uploadedAt,
    uploadedBy: upload.uploadedBy,
  };
}
