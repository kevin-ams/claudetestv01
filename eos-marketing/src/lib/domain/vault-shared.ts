import { parse as parseYaml } from "yaml";

// Utilidades del vault (Conocimiento) que se usan en el servidor y en el navegador.

export type EosKind = "rock" | "issue" | "kpi";
export const EOS_KINDS: EosKind[] = ["rock", "issue", "kpi"];
export const EOS_LABEL: Record<EosKind, string> = { rock: "Rock", issue: "Issue", kpi: "KPI" };

export type NoteSummary = {
  id: number;
  path: string;
  title: string;
  tags: string[];
  updated_at: string;
  updated_by_name: string | null;
  /** Destinos normalizados de sus [[enlaces]] a otras notas. */
  links: string[];
};

export type Note = NoteSummary & {
  content: string;
  frontmatter: Record<string, unknown>;
  version: number;
  created_at: string;
  created_by_name: string | null;
};

export type EosEntity = { kind: EosKind; id: number; title: string; team: string; href: string };

export type Wikilink = {
  /** Texto completo, p. ej. "[[Proceso de inscripción|inscripción]]". */
  raw: string;
  /** Destino tal como se escribió (sin alias ni #encabezado). */
  target: string;
  alias: string | null;
  kind: "note" | EosKind;
  /** Para enlaces EOS: lo que va después de "rock:" (id o nombre). */
  ref: string;
  index: number;
};

/** Minúsculas, sin acentos, sin ".md" y con espacios simples: para comparar títulos y rutas. */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Proceso de inscripción" → "proceso-de-inscripcion" */
export function slugify(s: string): string {
  return (
    normalizeKey(s)
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "nota"
  );
}

export function cleanFolder(folder: string): string {
  return folder
    .split("/")
    .map((p) => slugify(p))
    .filter((p) => p && p !== "nota")
    .join("/");
}

export function folderOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function pathFor(folder: string, title: string): string {
  const f = cleanFolder(folder);
  return `${f ? `${f}/` : ""}${slugify(title)}.md`;
}

/** Claves con las que se puede enlazar una nota: título, ruta y nombre de archivo. */
export function noteKeys(n: { title: string; path: string }): string[] {
  const base = n.path.split("/").pop() ?? n.path;
  return [...new Set([normalizeKey(n.title), normalizeKey(n.path), normalizeKey(base)])];
}

/** Quita los bloques de código (``` y `inline`) para no leer enlaces ni tags dentro de ellos. */
function withoutCode(content: string): string {
  return content.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length)).replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

const WIKILINK = /\[\[([^[\]|#\n]+)(#[^[\]|\n]*)?(?:\|([^[\]\n]+))?\]\]/g;

export function extractWikilinks(content: string): Wikilink[] {
  const text = withoutCode(content);
  const out: Wikilink[] = [];
  for (const m of text.matchAll(WIKILINK)) {
    const target = m[1].trim();
    if (!target) continue;
    const eos = /^(rock|issue|kpi):\s*(.+)$/i.exec(target);
    out.push({
      raw: content.slice(m.index!, m.index! + m[0].length),
      target,
      alias: m[3]?.trim() || null,
      kind: eos ? (eos[1].toLowerCase() as EosKind) : "note",
      ref: eos ? eos[2].trim() : target,
      index: m.index!,
    });
  }
  return out;
}

/** Separa el frontmatter YAML (--- … ---) del cuerpo. */
export function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return { data: {}, body: content };
  try {
    const data = parseYaml(m[1]);
    return { data: data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {}, body: content.slice(m[0].length) };
  } catch {
    return { data: {}, body: content.slice(m[0].length) };
  }
}

const TAG = /(^|[\s(,;])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;

/** #tags en línea y "tags:" del frontmatter (en minúsculas, sin repetir). */
export function extractTags(content: string): string[] {
  const { data, body } = parseFrontmatter(content);
  const tags = new Set<string>();
  const fm = data.tags ?? data.tag;
  const list = Array.isArray(fm) ? fm : typeof fm === "string" ? fm.split(/[,\s]+/) : [];
  for (const t of list) {
    const v = String(t).replace(/^#/, "").trim().toLowerCase();
    if (v) tags.add(v);
  }
  // Sin código ni enlaces (las URLs pueden tener #ancla).
  const text = withoutCode(body).replace(/https?:\/\/\S+/g, " ").replace(WIKILINK, " ");
  for (const m of text.matchAll(TAG)) {
    if (/^\d+$/.test(m[2])) continue; // "#1" no es un tag
    tags.add(m[2].toLowerCase());
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Al renombrar una nota, cambia sus [[enlaces]] en otro contenido: [[Viejo]] → [[Nuevo]] y
 * [[Viejo|texto]] → [[Nuevo|texto]] (se conserva el #encabezado).
 */
export function renameLinks(content: string, oldKeys: string[], newTitle: string): string {
  const keys = new Set(oldKeys);
  let changed = false;
  const next = content.replace(WIKILINK, (all, target: string, heading: string | undefined, alias: string | undefined) => {
    if (/^(rock|issue|kpi):/i.test(target.trim()) || !keys.has(normalizeKey(target))) return all;
    changed = true;
    return `[[${newTitle}${heading ?? ""}${alias ? `|${alias}` : ""}]]`;
  });
  return changed ? next : content;
}

// --- Árbol de carpetas ------------------------------------------------------------

export type TreeFolder = { name: string; path: string; folders: TreeFolder[]; notes: NoteSummary[] };

export function buildTree(notes: NoteSummary[]): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], notes: [] };
  for (const n of notes) {
    const parts = folderOf(n.path).split("/").filter(Boolean);
    let cur = root;
    for (const part of parts) {
      const path = cur.path ? `${cur.path}/${part}` : part;
      let next = cur.folders.find((f) => f.name === part);
      if (!next) {
        next = { name: part, path, folders: [], notes: [] };
        cur.folders.push(next);
      }
      cur = next;
    }
    cur.notes.push(n);
  }
  const sort = (f: TreeFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name, "es"));
    f.notes.sort((a, b) => a.title.localeCompare(b.title, "es"));
    f.folders.forEach(sort);
  };
  sort(root);
  return root;
}

// --- Plantillas ---------------------------------------------------------------------

export const TEMPLATE_FOLDER = "plantillas";

export const DEFAULT_TEMPLATES: { title: string; content: string }[] = [
  {
    title: "Proceso",
    content: `---
tipo: proceso
dueño:
revisado:
tags: [proceso]
---
# {{titulo}}

## Objetivo
¿Para qué existe este proceso?

## Responsable
Persona o puesto que lo dirige (según el organigrama).

## Pasos
1.
2.
3.

## Indicadores
Enlaza los indicadores del Scorecard con \`[[kpi:Nombre]]\`.

## Documentos y enlaces relacionados
-
`,
  },
  {
    title: "Acta L10",
    content: `---
tipo: acta
fecha: {{fecha}}
tags: [l10]
---
# {{titulo}}

## Asistentes

## Titulares y buenas noticias

## Issues resueltos (IDS)
Enlaza cada Issue con \`[[issue:Título]]\`.

## To-Dos acordados

## Mensajes a cascadear
`,
  },
  {
    title: "Lección aprendida",
    content: `---
tipo: leccion
fecha: {{fecha}}
tags: [leccion-aprendida]
---
# {{titulo}}

## Qué pasó

## Qué aprendimos

## Qué haremos diferente

## Relacionado
Enlaza rocks, issues o notas con \`[[rock:Título]]\`, \`[[issue:Título]]\` o \`[[Nota]]\`.
`,
  },
  {
    title: "Guía / How-to",
    content: `---
tipo: guia
tags: [guia]
---
# {{titulo}}

> Para quién es esta guía y qué logra al terminar.

## Antes de empezar

## Paso a paso
1.
2.

## Preguntas frecuentes
`,
  },
];

/** Rellena {{titulo}} y {{fecha}} de una plantilla. */
export function applyTemplate(content: string, title: string, today: string): string {
  return content.replaceAll("{{titulo}}", title).replaceAll("{{fecha}}", today);
}

// --- Búsqueda ---------------------------------------------------------------------------

/** Modelo de embeddings (en el navegador). Si cambia, todos los fragmentos se recalculan. */
export const EMBED_MODEL = "Xenova/multilingual-e5-small";
export const EMBED_DIM = 384;

/**
 * Minúsculas y sin acentos, carácter por carácter (misma longitud que el original), para poder
 * ubicar en el texto original lo que se encontró en el texto plegado.
 */
export function foldText(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = c.charCodeAt(0);
    if (code < 128) {
      out += c.toLowerCase();
      continue;
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      out += c;
      continue;
    }
    const f = c.normalize("NFD").charAt(0).toLowerCase();
    out += f.length === 1 ? f : c;
  }
  return out;
}

/** Palabras de una búsqueda (plegadas). */
export function queryTerms(q: string): string[] {
  return [...new Set(foldText(q).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0))].slice(0, 12);
}

// Palabras vacías del español (ya sin acentos): no sirven para buscar por palabras.
const STOPWORDS = new Set(
  "a al algo como con cual cuales cuando de del donde el ella ellos en entre era es esa ese eso esta este esto estos estas fue ha hay la las le les lo los mas me mi mis muy no nos o para pero por porque que quien se ser si sin sobre son su sus te tu tus un una unas uno unos y ya yo".split(" "),
);

/** Palabras útiles para buscar (sin palabras vacías; si solo hay vacías, se usan todas). */
export function searchTerms(q: string): string[] {
  const all = queryTerms(q);
  const useful = all.filter((t) => !STOPWORDS.has(t));
  return useful.length ? useful : all;
}

/** Fragmento del texto original alrededor de la primera coincidencia. */
export function snippetAround(original: string, folded: string, terms: string[], size = 180): string {
  let at = -1;
  for (const t of terms) {
    const i = folded.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at < 0 ? 0 : at - Math.floor(size / 3));
  const text = original.slice(start, start + size).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${start + size < original.length ? "…" : ""}`;
}

/**
 * Divide una nota en fragmentos de ~500–800 caracteres, cortando por encabezados y párrafos.
 * Cada fragmento lleva el título (y su encabezado) para que tenga contexto.
 */
export function chunkNote(title: string, content: string, max = 800): string[] {
  const { body } = parseFrontmatter(content);
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chunks: string[] = [];
  let heading = "";
  let cur = "";
  const prefix = () => `${title}${heading ? ` › ${heading}` : ""}\n`;
  const push = () => {
    if (cur.trim()) chunks.push(prefix() + cur.trim());
    cur = "";
  };
  for (const block of blocks) {
    const h = /^(#{1,6})\s+(.+)$/m.exec(block);
    if (h && block.startsWith("#")) {
      push();
      heading = h[2].trim();
      const rest = block.slice(h[0].length).trim();
      if (rest) cur = rest;
      continue;
    }
    if (block.length > max) {
      push();
      // Bloque largo: se corta por oraciones.
      let piece = "";
      for (const s of block.split(/(?<=[.!?])\s+/)) {
        if ((piece + " " + s).length > max && piece) {
          chunks.push(prefix() + piece.trim());
          piece = "";
        }
        piece += ` ${s}`;
      }
      cur = piece.trim();
      continue;
    }
    if ((cur + "\n\n" + block).length > max && cur.length >= 300) push();
    cur = cur ? `${cur}\n\n${block}` : block;
  }
  push();
  if (chunks.length === 0) chunks.push(title);
  return chunks.slice(0, 200);
}

/** Reciprocal Rank Fusion: combina rankings (listas de ids) en un solo puntaje. */
export function reciprocalRankFusion(lists: number[][], k = 60): Map<number, number> {
  const score = new Map<number, number>();
  for (const list of lists) list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  return score;
}

export type TextHit = { id: number; title: string; path: string; snippet: string; rank: number };
export type MeaningHit = { id: number; title: string; path: string; snippet: string; score: number };
