import Graph from "graphology";
import { EOS_LABEL, TEMPLATE_FOLDER, folderOf, noteKeys, normalizeKey, type EosEntity, type EosKind, type NoteSummary } from "@/lib/domain/vault-shared";

// Grafo del vault: notas (nodos) y [[enlaces]] (aristas), más tags, entidades EOS, notas fantasma y
// relaciones por significado opcionales. Se arma en el navegador con los datos que ya tiene la pantalla.

export type NodeKind = "note" | "ghost" | "tag" | "eos";
export type NodeAttrs = {
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  size: number;
  color: string;
  noteId?: number;
  tags?: string[];
  path?: string;
  /** Destino del enlace (notas fantasma). */
  target?: string;
  href?: string;
  tag?: string;
  orphan?: boolean;
  updated?: string;
};
export type EdgeAttrs = { kind: "link" | "tag" | "eos" | "semantic"; size: number; color: string; score?: number };

export type GraphOptions = {
  showTags: boolean;
  showEos: boolean;
  showGhosts: boolean;
  semantic: { a: number; b: number; score: number }[] | null;
  folder: string;
  tag: string;
  sinceDays: number;
  /** Grafo local: la nota y sus vecinos a `depth` saltos. */
  local?: { noteId: number; depth: number } | null;
};

/** Colores por carpeta raíz (legibles en tema claro y oscuro). */
export const FOLDER_COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#4f46e5", "#0d9488"];
const ROOT_COLOR = "#64748b";
const GHOST_COLOR = "#9ca3af";
const TAG_COLOR = "#a855f7";
const EOS_COLOR: Record<EosKind, string> = { rock: "#059669", issue: "#e11d48", kpi: "#0284c7" };

export const rootFolder = (path: string) => folderOf(path).split("/")[0] ?? "";

export function folderColors(notes: NoteSummary[]): Map<string, string> {
  const roots = [...new Set(notes.map((n) => rootFolder(n.path)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return new Map(roots.map((r, i) => [r, FOLDER_COLORS[i % FOLDER_COLORS.length]]));
}

export function buildGraph(all: NoteSummary[], entities: EosEntity[], o: GraphOptions): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", allowSelfLoops: false });
  const colors = folderColors(all.filter((n) => !n.path.startsWith(`${TEMPLATE_FOLDER}/`)));
  const since = o.sinceDays > 0 ? Date.now() - o.sinceDays * 86400_000 : 0;
  const notes = all.filter(
    (n) =>
      !n.path.startsWith(`${TEMPLATE_FOLDER}/`) &&
      (!o.folder || n.path.startsWith(`${o.folder}/`)) &&
      (!o.tag || n.tags.includes(o.tag)) &&
      (!since || new Date(n.updated_at).getTime() >= since),
  );

  // Con muchas notas, nodos más chicos para que no se encimen.
  const scale = notes.length > 1000 ? 0.45 : notes.length > 300 ? 0.65 : 1;

  // Índice para resolver [[enlaces]] (con todas las notas, aunque estén filtradas).
  const byKey = new Map<string, NoteSummary>();
  for (const n of all) for (const k of noteKeys(n)) if (!byKey.has(k)) byKey.set(k, n);
  const visible = new Set(notes.map((n) => n.id));

  // Aristas entre notas y conteo de enlaces entrantes.
  const pairs: [number, number][] = [];
  const ghosts = new Map<string, Set<number>>();
  const inbound = new Map<number, number>();
  const degree = new Map<number, number>();
  for (const n of notes) {
    for (const t of n.links) {
      const hit = byKey.get(normalizeKey(t));
      if (!hit) {
        if (!ghosts.has(t)) ghosts.set(t, new Set());
        ghosts.get(t)!.add(n.id);
        degree.set(n.id, (degree.get(n.id) ?? 0) + 1); // enlazar a una nota por crear no es estar huérfana
        continue;
      }
      if (hit.id === n.id) continue;
      inbound.set(hit.id, (inbound.get(hit.id) ?? 0) + 1);
      degree.set(hit.id, (degree.get(hit.id) ?? 0) + 1);
      degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
      if (visible.has(hit.id)) pairs.push([n.id, hit.id]);
    }
  }

  // Grafo local: vecinos a `depth` saltos por enlaces (en ambos sentidos).
  let keep: Set<number> | null = null;
  if (o.local) {
    const adj = new Map<number, Set<number>>();
    for (const [a, b] of pairs) {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
    keep = new Set([o.local.noteId]);
    let frontier = [o.local.noteId];
    for (let d = 0; d < o.local.depth; d++) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const nb of adj.get(id) ?? []) {
          if (keep.has(nb)) continue;
          keep.add(nb);
          next.push(nb);
        }
      }
      frontier = next;
    }
  }
  const shown = (id: number) => visible.has(id) && (!keep || keep.has(id));

  for (const n of notes) {
    if (!shown(n.id)) continue;
    const links = degree.get(n.id) ?? 0;
    g.addNode(`n:${n.id}`, {
      label: n.title,
      kind: "note",
      x: 0,
      y: 0,
      size: scale * Math.min(22, 7 + 3 * Math.sqrt(inbound.get(n.id) ?? 0)),
      color: colors.get(rootFolder(n.path)) ?? ROOT_COLOR,
      noteId: n.id,
      tags: n.tags,
      path: n.path,
      orphan: links === 0,
      updated: n.updated_at,
    });
  }
  for (const [a, b] of pairs) {
    if (!shown(a) || !shown(b)) continue;
    const s = `n:${a}`, t = `n:${b}`;
    if (!g.hasEdge(s, t)) g.addEdge(s, t, { kind: "link", size: 1.5, color: "#94a3b8" });
  }

  if (o.showGhosts) {
    for (const [target, from] of ghosts) {
      const src = [...from].filter((id) => g.hasNode(`n:${id}`));
      if (!src.length) continue;
      const key = `g:${normalizeKey(target)}`;
      if (!g.hasNode(key)) g.addNode(key, { label: target, kind: "ghost", x: 0, y: 0, size: 5 * scale, color: GHOST_COLOR, target });
      for (const id of src) if (!g.hasEdge(`n:${id}`, key)) g.addEdge(`n:${id}`, key, { kind: "link", size: 1, color: "#cbd5e1" });
    }
  }
  if (o.showTags) {
    for (const n of notes) {
      if (!g.hasNode(`n:${n.id}`)) continue;
      for (const tag of n.tags) {
        const key = `t:${tag}`;
        if (!g.hasNode(key)) g.addNode(key, { label: `#${tag}`, kind: "tag", x: 0, y: 0, size: 4 * scale, color: TAG_COLOR, tag });
        if (!g.hasEdge(`n:${n.id}`, key)) g.addEdge(`n:${n.id}`, key, { kind: "tag", size: 0.6, color: "#e9d5ff" });
      }
    }
  }
  if (o.showEos) {
    const byRef = new Map(entities.map((e) => [`${e.kind}:${e.id}`, e]));
    for (const n of notes) {
      if (!g.hasNode(`n:${n.id}`)) continue;
      for (const ref of n.eos) {
        const e = byRef.get(ref);
        if (!e) continue;
        const key = `e:${ref}`;
        if (!g.hasNode(key)) g.addNode(key, { label: `${EOS_LABEL[e.kind]}: ${e.title}`, kind: "eos", x: 0, y: 0, size: 7 * scale, color: EOS_COLOR[e.kind], href: e.href });
        if (!g.hasEdge(`n:${n.id}`, key)) g.addEdge(`n:${n.id}`, key, { kind: "eos", size: 1, color: "#a7f3d0" });
      }
    }
  }
  if (o.semantic) {
    for (const p of o.semantic) {
      const a = `n:${p.a}`, b = `n:${p.b}`;
      if (!g.hasNode(a) || !g.hasNode(b) || g.hasEdge(a, b)) continue;
      g.addEdge(a, b, { kind: "semantic", size: 1, color: "#fbbf24", score: p.score });
    }
  }
  return g;
}

/** Notas sin enlaces de entrada ni de salida. */
export function orphanIds(g: Graph<NodeAttrs, EdgeAttrs>): number[] {
  const out: number[] = [];
  g.forEachNode((_k, a) => {
    if (a.kind === "note" && a.orphan && a.noteId) out.push(a.noteId);
  });
  return out;
}
