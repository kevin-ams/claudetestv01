import { describe, expect, it } from "vitest";
import { buildGraph, orphanIds, type GraphOptions } from "@/app/(app)/conocimiento/graph-model";
import type { EosEntity, NoteSummary } from "@/lib/domain/vault-shared";

const note = (id: number, title: string, path: string, links: string[] = [], extra: Partial<NoteSummary> = {}): NoteSummary => ({
  id,
  title,
  path,
  tags: [],
  updated_at: new Date().toISOString(),
  updated_by_name: null,
  links,
  eos: [],
  ...extra,
});
const base: GraphOptions = { showTags: false, showEos: false, showGhosts: false, semantic: null, folder: "", tag: "", sinceDays: 0 };

const notes = [
  note(1, "A", "procesos/a.md", ["B", "No existe"]),
  note(2, "B", "procesos/b.md", ["C"], { tags: ["x"], eos: ["rock:7"] }),
  note(3, "C", "finanzas/c.md"),
  note(4, "Suelta", "d.md"),
  note(5, "Plantilla", "plantillas/p.md", ["A"]),
];
const entities: EosEntity[] = [{ kind: "rock", id: 7, title: "Rock 7", team: "Mkt", href: "/rocks" }];

describe("grafo", () => {
  it("nodos = notas (sin plantillas) y aristas = enlaces que existen", () => {
    const g = buildGraph(notes, entities, base);
    expect(g.nodes().sort()).toEqual(["n:1", "n:2", "n:3", "n:4"]);
    expect(g.size).toBe(2);
  });
  it("detecta huérfanas (sin enlaces de entrada ni de salida)", () => {
    expect(orphanIds(buildGraph(notes, entities, base))).toEqual([4]);
  });
  it("capas opcionales: notas por crear, tags y EOS", () => {
    const g = buildGraph(notes, entities, { ...base, showGhosts: true, showTags: true, showEos: true });
    expect(g.hasNode("g:no existe")).toBe(true);
    expect(g.getNodeAttribute("g:no existe", "label")).toBe("No existe");
    expect(g.hasNode("t:x")).toBe(true);
    expect(g.getNodeAttribute("e:rock:7", "label")).toBe("Rock: Rock 7");
  });
  it("grafo local por saltos", () => {
    expect(buildGraph(notes, entities, { ...base, local: { noteId: 1, depth: 1 } }).nodes().sort()).toEqual(["n:1", "n:2"]);
    expect(buildGraph(notes, entities, { ...base, local: { noteId: 1, depth: 2 } }).nodes().sort()).toEqual(["n:1", "n:2", "n:3"]);
  });
  it("filtros por carpeta y relaciones por significado", () => {
    expect(buildGraph(notes, entities, { ...base, folder: "procesos" }).order).toBe(2);
    const g = buildGraph(notes, entities, { ...base, semantic: [{ a: 1, b: 4, score: 0.9 }] });
    expect(g.getEdgeAttribute(g.edge("n:1", "n:4")!, "kind")).toBe("semantic");
  });
});
