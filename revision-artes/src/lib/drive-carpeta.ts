import "server-only";

/**
 * Lee los archivos de una carpeta pública de Google Drive ("Cualquier persona
 * con el enlace") sin llave de API, a partir de la vista incrustada de la
 * carpeta. Cada archivo es un arte; las subcarpetas se ignoran.
 */
export type ArchivoCarpeta = { id: string; nombre: string; url: string };

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decodificar = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function leerCarpetaHtml(html: string): ArchivoCarpeta[] {
  const archivos: ArchivoCarpeta[] = [];
  const vistos = new Set<string>();
  const entrada = /<a href="(https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})\/[^"]*)"[^>]*>[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g;
  for (const m of html.matchAll(entrada)) {
    const id = m[2];
    if (vistos.has(id)) continue;
    vistos.add(id);
    archivos.push({ id, nombre: decodificar(m[3]).trim(), url: `https://drive.google.com/file/d/${id}/view` });
  }
  return archivos;
}

/** Título del arte a partir del nombre del archivo (sin extensión). */
export function tituloDeArchivo(nombre: string) {
  return nombre.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim() || nombre;
}

export async function listarCarpeta(id: string): Promise<{ ok: true; archivos: ArchivoCarpeta[] } | { ok: false; error: string }> {
  try {
    // DRIVE_CARPETA_URL solo se usa en pruebas locales (simulador de Drive).
    const base = process.env.DRIVE_CARPETA_URL || "https://drive.google.com/embeddedfolderview";
    const res = await fetch(`${base}?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 404 || res.status === 403) {
      return { ok: false, error: "No se pudo abrir la carpeta. Compártela como “Cualquier persona con el enlace”." };
    }
    if (!res.ok) return { ok: false, error: `Google Drive respondió con un error (${res.status}).` };
    const archivos = leerCarpetaHtml(await res.text());
    if (archivos.length === 0) {
      return { ok: false, error: "La carpeta está vacía, solo tiene subcarpetas o no es pública." };
    }
    return { ok: true, archivos };
  } catch {
    return { ok: false, error: "No se pudo conectar con Google Drive. Intenta de nuevo." };
  }
}
