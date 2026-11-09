import { describe, expect, it } from "vitest";
import {
  buildTree,
  chunkNote,
  extractTags,
  extractWikilinks,
  foldText,
  noteKeys,
  normalizeKey,
  parseFrontmatter,
  pathFor,
  reciprocalRankFusion,
  renameLinks,
  searchTerms,
  snippetAround,
  type NoteSummary,
} from "@/lib/domain/vault-shared";

describe("wikilinks", () => {
  it("lee destino, alias, encabezado y enlaces EOS", () => {
    const l = extractWikilinks("Ver [[Proceso de inscripción|inscripción]], [[Becas#Requisitos]] y [[rock:12]] o [[ISSUE: Bajas]].");
    expect(l.map((x) => [x.kind, x.target, x.alias, x.ref])).toEqual([
      ["note", "Proceso de inscripción", "inscripción", "Proceso de inscripción"],
      ["note", "Becas", null, "Becas"],
      ["rock", "rock:12", null, "12"],
      ["issue", "ISSUE: Bajas", null, "Bajas"],
    ]);
  });
  it("ignora enlaces dentro de bloques de código", () => {
    expect(extractWikilinks("```\n[[No]]\n```\n`[[Tampoco]]` [[Sí]]").map((l) => l.target)).toEqual(["Sí"]);
  });
});

describe("tags", () => {
  it("toma #tags en línea y del frontmatter, sin URLs, números ni código", () => {
    const md = "---\ntags: [Proceso, admisiones]\n---\n# Título\nTexto #becas y #año-2027 https://x.com/#ancla #1 `#codigo` [[Nota#sección]]";
    expect(extractTags(md)).toEqual(["admisiones", "año-2027", "becas", "proceso"]);
  });
  it("acepta tags como texto separado por comas", () => {
    expect(extractTags("---\ntags: a, b\n---\n")).toEqual(["a", "b"]);
  });
});

describe("frontmatter", () => {
  it("separa el YAML del cuerpo", () => {
    const { data, body } = parseFrontmatter("---\ntipo: proceso\nfecha: \"{{fecha}}\"\n---\n# Hola");
    expect(data).toEqual({ tipo: "proceso", fecha: "{{fecha}}" });
    expect(body).toBe("# Hola");
  });
  it("sin frontmatter devuelve el contenido entero", () => {
    expect(parseFrontmatter("# Hola").body).toBe("# Hola");
  });
});

describe("renombrar", () => {
  it("cambia [[Viejo]] y [[Viejo|alias]] conservando alias y encabezado, y no toca enlaces EOS", () => {
    const keys = noteKeys({ title: "Guía de becas", path: "politicas/guia-de-becas.md" });
    const out = renameLinks("[[Guía de becas]] [[guia de becas|aquí]] [[politicas/guia-de-becas#Req]] [[Otra]] [[rock:Guía de becas]]", keys, "Becas 2027");
    expect(out).toBe("[[Becas 2027]] [[Becas 2027|aquí]] [[Becas 2027#Req]] [[Otra]] [[rock:Guía de becas]]");
  });
  it("devuelve el mismo texto si no hay nada que cambiar", () => {
    const s = "sin enlaces";
    expect(renameLinks(s, ["x"], "y")).toBe(s);
  });
});

describe("claves y rutas", () => {
  it("normaliza sin acentos ni mayúsculas ni .md", () => {
    expect(normalizeKey("  Proceso de INSCRIPCIÓN.md ")).toBe("proceso de inscripcion");
    expect(pathFor("Procesos/Admisiones", "¿Cómo inscribir?")).toBe("procesos/admisiones/como-inscribir.md");
  });
  it("arma el árbol de carpetas ordenado", () => {
    const n = (id: number, path: string, title: string): NoteSummary => ({ id, path, title, tags: [], updated_at: "", updated_by_name: null, links: [], eos: [] });
    const tree = buildTree([n(1, "b/z.md", "Z"), n(2, "a.md", "A"), n(3, "b/c/y.md", "Y")]);
    expect(tree.notes.map((x) => x.title)).toEqual(["A"]);
    expect(tree.folders.map((f) => f.path)).toEqual(["b"]);
    expect(tree.folders[0].folders[0].notes[0].title).toBe("Y");
  });
});

describe("búsqueda", () => {
  it("foldText conserva la longitud (para ubicar fragmentos en el original)", () => {
    const s = "Matrícula ÁÉÍÓÚ ñ — 😀 fin";
    expect(foldText(s)).toHaveLength(s.length);
    expect(foldText("Matrícula")).toBe("matricula");
  });
  it("quita palabras vacías, salvo que solo haya vacías", () => {
    expect(searchTerms("cómo damos de alta a un estudiante")).toEqual(["damos", "alta", "estudiante"]);
    expect(searchTerms("de la")).toEqual(["de", "la"]);
  });
  it("recorta el fragmento alrededor de la coincidencia, en el texto original", () => {
    const text = `${"x ".repeat(100)}pagar la matrícula a tiempo`;
    expect(snippetAround(text, foldText(text), ["matricula"], 60)).toContain("matrícula");
  });
  it("Reciprocal Rank Fusion premia lo que aparece arriba en varias listas", () => {
    const s = reciprocalRankFusion([[1, 2, 3], [2, 1], [2]]);
    expect([...s.entries()].sort((a, b) => b[1] - a[1])[0][0]).toBe(2);
  });
});

describe("fragmentos (chunking)", () => {
  it("corta por encabezados, lleva título y encabezado, y respeta el tamaño", () => {
    const body = ["# Intro", "a".repeat(300), "## Pasos", ...Array.from({ length: 6 }, (_, i) => `Paso ${i}: ${"b".repeat(250)}`)].join("\n\n");
    const chunks = chunkNote("Proceso", `---\ntipo: x\n---\n${body}`);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].startsWith("Proceso › Intro\n")).toBe(true);
    expect(chunks.some((c) => c.startsWith("Proceso › Pasos\n"))).toBe(true);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(800 + 40);
    expect(chunks.join("")).not.toContain("tipo: x");
  });
  it("una nota vacía produce un fragmento con el título", () => {
    expect(chunkNote("Sola", "")).toEqual(["Sola"]);
  });
});
