/** P1: transacciones, lotes y enlaces del vault escritos en lote. */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { backlinks, createNote, getNote, getVault, notesForEntities, saveNote } from "@/lib/domain/vault";
import { createRock } from "@/lib/domain/rocks";
import { person, realTeam } from "./helpers";

let team: number, user: number;

beforeAll(async () => {
  team = (await realTeam("Equipo DB")).id;
  user = (await person(team)).id;
  await db().sql`CREATE TABLE IF NOT EXISTS _tx_test (v INT)`;
});

describe("db().transaction", () => {
  it("confirma todo si no hay error", async () => {
    const n = await db().transaction(async (tx) => {
      await tx.sql`INSERT INTO _tx_test (v) VALUES (${1})`;
      await tx.sql`INSERT INTO _tx_test (v) VALUES (${2})`;
      return (await tx.sql`SELECT count(*)::int AS n FROM _tx_test`)[0].n;
    });
    expect(Number(n)).toBe(2);
  });

  it("deshace todo si algo falla a la mitad", async () => {
    await expect(
      db().transaction(async (tx) => {
        await tx.sql`INSERT INTO _tx_test (v) VALUES (${3})`;
        throw new Error("falla a la mitad");
      })
    ).rejects.toThrow("falla a la mitad");
    const rows = await db().sql`SELECT v FROM _tx_test WHERE v = ${3}`;
    expect(rows).toHaveLength(0);
  });

  it("un lote con una sentencia inválida no deja nada", async () => {
    await expect(
      db().batch([
        { text: "INSERT INTO _tx_test (v) VALUES ($1)", params: [4] },
        { text: "INSERT INTO tabla_que_no_existe (v) VALUES ($1)", params: [5] },
      ])
    ).rejects.toThrow();
    expect(await db().sql`SELECT v FROM _tx_test WHERE v = ${4}`).toHaveLength(0);
  });
});

describe("enlaces del vault en lote", () => {
  it("guarda enlaces a notas y a Rocks, y los renombra en las otras notas", async () => {
    const vault = await getVault(team);
    const rock = await createRock({ teamId: team, ownerId: user, title: "Lanzar campaña", description: "", isCompanyRock: false, quarter: 1, year: 2026, dueDate: null });
    const target = await createNote({ vaultId: vault.id, teamId: team, folder: "", title: "Guía", content: "Hola", userId: user });
    const from = await createNote({
      vaultId: vault.id, teamId: team, folder: "", title: "Plan",
      content: "Ver [[Guía]], otra vez [[guía]] y [[rock:Lanzar campaña]]", userId: user,
    });

    const links = await db().sql`SELECT kind, target, entity_id FROM vault_links WHERE from_note_id = ${from} ORDER BY kind`;
    expect(links).toHaveLength(2); // [[Guía]] y [[guía]] son el mismo destino
    expect(links.find((l) => l.kind === "rock")?.entity_id).toBe(rock.id);
    expect((await notesForEntities(team, "rock", [rock.id]))[rock.id]?.[0]?.id).toBe(from);

    const t = (await getNote(vault.id, target))!;
    const r = await saveNote({ vaultId: vault.id, teamId: team, id: target, title: "Guía nueva", folder: "", content: "Hola", baseVersion: t.version, userId: user });
    expect(r.ok && r.renamed).toBe(1);
    expect((await getNote(vault.id, from))!.content).toContain("[[Guía nueva]]");
    const back = await backlinks(vault.id, { id: target, title: "Guía nueva", path: "guia-nueva.md" });
    expect(back.map((b) => b.id)).toContain(from);
  });
});
