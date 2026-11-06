import { beforeAll, describe, expect, it } from "vitest";
import {
  backlinks,
  chunkPlan,
  createNote,
  findNoteByKey,
  getNote,
  getVault,
  listNotes,
  meaningSearch,
  relatedByMeaning,
  saveNote,
  semanticEdges,
  storeChunks,
  textSearch,
} from "@/lib/domain/vault";
import { EMBED_DIM } from "@/lib/domain/vault-shared";
import { demoOrg, person, realTeam } from "./helpers";

const unit = (i: number) => Array.from({ length: EMBED_DIM }, (_, k) => (k === i ? 1 : 0));

let A1: number, A2: number, B: number, userA: number, userB: number;
let noteA: number;

beforeAll(async () => {
  A1 = (await realTeam("Marketing")).id;
  A2 = (await realTeam("Comunicación")).id;
  userA = (await person(A1)).id;
  const b = await demoOrg("Demo de otra organización");
  B = b.team.id;
  userB = b.owner.id;
  const vA = await getVault(A1);
  noteA = await createNote({ vaultId: vA.id, teamId: A1, folder: "procesos", title: "Proceso de inscripción", content: "Pago de matrícula y documentos. #admisiones", userId: userA });
});

describe("un vault por organización", () => {
  it("los equipos de la misma organización comparten vault; otra organización tiene el suyo", async () => {
    const [v1, v2, vb] = await Promise.all([getVault(A1), getVault(A2), getVault(B)]);
    expect(v1.id).toBe(v2.id);
    expect(vb.id).not.toBe(v1.id);
  });
  it("cada vault nuevo trae sus plantillas", async () => {
    const titles = (await listNotes((await getVault(B)).id)).map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(["Proceso", "Acta L10", "Lección aprendida", "Guía / How-to"]));
  });
});

describe("aislamiento entre organizaciones", () => {
  it("la otra organización no ve, busca, abre ni enlaza notas ajenas", async () => {
    const vB = (await getVault(B)).id;
    expect((await listNotes(vB)).some((n) => n.id === noteA)).toBe(false);
    expect(await textSearch(vB, "matricula")).toEqual([]);
    expect(await getNote(vB, noteA)).toBeNull();
    expect(await findNoteByKey(vB, "Proceso de inscripción")).toBeNull();
    expect(await chunkPlan(vB, noteA)).toBeNull();
    expect(await storeChunks(vB, noteA, 1, [{ index: 0, embedding: unit(0) }])).toBe(false);
  });
  it("búsqueda por significado y relaciones no cruzan de vault", async () => {
    const vA = (await getVault(A1)).id;
    const vB = (await getVault(B)).id;
    const plan = (await chunkPlan(vA, noteA))!;
    expect(await storeChunks(vA, noteA, plan.version, plan.chunks.map((c) => ({ index: c.index, embedding: unit(1) })))).toBe(true);
    expect((await meaningSearch(vA, unit(1))).map((h) => h.id)).toContain(noteA);
    expect(await meaningSearch(vB, unit(1))).toEqual([]);
    expect(await relatedByMeaning(vB, noteA)).toEqual([]);
    expect((await semanticEdges(vB, 0.5)).some((e) => e.a === noteA || e.b === noteA)).toBe(false);
  });
  it("rechaza vectores inválidos", async () => {
    const vA = (await getVault(A1)).id;
    expect(await meaningSearch(vA, [1, 2, 3])).toEqual([]);
    expect(await meaningSearch(vA, "hola")).toEqual([]);
  });
});

describe("guardar notas", () => {
  it("no sobrescribe en silencio: con una versión vieja hay conflicto", async () => {
    const vA = (await getVault(A1)).id;
    const n = (await getNote(vA, noteA))!;
    const ok = await saveNote({ vaultId: vA, teamId: A1, id: noteA, title: n.title, folder: "procesos", content: `${n.content}\nUno`, baseVersion: n.version, userId: userA });
    expect(ok.ok).toBe(true);
    const stale = await saveNote({ vaultId: vA, teamId: A1, id: noteA, title: n.title, folder: "procesos", content: "Pisaría", baseVersion: n.version, userId: userA });
    expect(stale).toMatchObject({ ok: false, conflict: true });
    expect((await getNote(vA, noteA))!.content).toContain("Uno");
  });
  it("renombrar actualiza los enlaces en las demás notas y los backlinks", async () => {
    const vA = (await getVault(A1)).id;
    const target = await createNote({ vaultId: vA, teamId: A1, folder: "politicas", title: "Guía de becas", content: "Becas", userId: userA });
    const from = await createNote({ vaultId: vA, teamId: A1, folder: "", title: "Índice", content: "Ver [[Guía de becas]] y [[guia de becas|aquí]]", userId: userA });
    expect((await backlinks(vA, (await getNote(vA, target))!)).map((b) => b.id)).toEqual([from]);
    const t = (await getNote(vA, target))!;
    const r = await saveNote({ vaultId: vA, teamId: A1, id: target, title: "Becas 2027", folder: "politicas", content: t.content, baseVersion: t.version, userId: userA });
    expect(r).toMatchObject({ ok: true, renamed: 1 });
    expect((await getNote(vA, from))!.content).toBe("Ver [[Becas 2027]] y [[Becas 2027|aquí]]");
    expect((await backlinks(vA, (await getNote(vA, target))!)).map((b) => b.id)).toEqual([from]);
  });
  it("una persona de otra organización no puede guardar en este vault", async () => {
    const vB = (await getVault(B)).id;
    const r = await saveNote({ vaultId: vB, teamId: B, id: noteA, title: "X", folder: "", content: "hack", baseVersion: 1, userId: userB });
    expect(r.ok).toBe(false);
  });
});
