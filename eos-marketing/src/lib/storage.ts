import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Archivos subidos (imágenes de anuncios).
 * - En tu computadora: carpeta `.data/uploads`.
 * - En Netlify: Netlify Blobs (el disco de las funciones no es permanente).
 */
type Store = {
  kind: "nube" | "local";
  where: string;
  put: (key: string, data: Uint8Array) => Promise<void>;
  get: (key: string) => Promise<Uint8Array | null>;
  remove: (key: string) => Promise<void>;
};

const LOCAL_DIR =
  process.env.EOS_UPLOADS_DIR ||
  path.join(path.dirname(process.env.EOS_DATA_DIR || path.join(process.cwd(), ".data", "pglite")), "uploads");

const local: Store = {
  kind: "local",
  where: LOCAL_DIR,
  async put(key, data) {
    const file = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  },
  async get(key) {
    try {
      return new Uint8Array(await readFile(path.join(LOCAL_DIR, key)));
    } catch {
      return null;
    }
  },
  async remove(key) {
    await rm(path.join(LOCAL_DIR, key), { force: true });
  },
};

let cached: Promise<Store> | undefined;

async function open(): Promise<Store> {
  if (process.env.EOS_FORCE_LOCAL_DB === "1") return local;
  try {
    const { getStore } = await import("@netlify/blobs");
    const blobs = getStore({ name: "eos-marketing-uploads", consistency: "strong" });
    return {
      kind: "nube",
      where: "Netlify Blobs (eos-marketing-uploads)",
      async put(key, data) {
        await blobs.set(key, new Blob([data as BlobPart]));
      },
      async get(key) {
        const buf = (await blobs.get(key, { type: "arrayBuffer" })) as ArrayBuffer | null;
        return buf ? new Uint8Array(buf) : null;
      },
      async remove(key) {
        await blobs.delete(key);
      },
    };
  } catch {
    // Fuera de Netlify no hay entorno de Blobs: se usa la carpeta local.
    return local;
  }
}

export function storage(): Promise<Store> {
  cached ??= open();
  return cached;
}
