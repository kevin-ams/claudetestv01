/**
 * P0: aislamiento entre equipos en el dominio EOS. Con el id de un registro de otro equipo,
 * ninguna función lee, modifica ni borra nada.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createIssue, deleteIssue, getIssue, solveIssue, updateIssue } from "@/lib/domain/issues";
import { completeTodo, createTodo, deleteTodo, getTodo, updateTodo } from "@/lib/domain/todos";
import {
  addMilestone,
  createRock,
  deleteMilestone,
  deleteRock,
  getMilestone,
  getRock,
  toggleMilestone,
  updateRockStatus,
} from "@/lib/domain/rocks";
import { createMeeting, getMeeting } from "@/lib/domain/meetings";
import {
  createMetric,
  createOwner,
  deleteOwner,
  getMetricName,
  getScorecardCell,
  listEntries,
  listTargets,
  setTarget,
  upsertEntry,
} from "@/lib/domain/scorecard";
import { deleteSeat } from "@/lib/domain/accountability";
import { person, realTeam } from "./helpers";

let A: number, B: number, userA: number, userB: number;

beforeAll(async () => {
  A = (await realTeam("Equipo A")).id;
  B = (await realTeam("Equipo B")).id;
  userA = (await person(A)).id;
  userB = (await person(B)).id;
});

describe("Issues", () => {
  it("otro equipo no lee, edita, resuelve ni borra", async () => {
    const issue = await createIssue({ teamId: A, title: "Issue de A", description: "", raisedBy: userA, ownerId: null, term: "short_term" });
    expect(await getIssue(B, issue.id)).toBeNull();
    expect(await updateIssue(B, issue.id, { title: "hackeado", description: "", ownerId: null, term: "short_term", dueDate: null })).toBe(false);
    expect(await solveIssue(B, issue.id)).toBe(false);
    expect(await deleteIssue(B, issue.id)).toBe(false);
    const still = await getIssue(A, issue.id);
    expect(still?.title).toBe("Issue de A");
    expect(still?.status).toBe("open");
  });
});

describe("To-Dos", () => {
  it("otro equipo no lee, edita, completa ni borra", async () => {
    const todo = await createTodo({ teamId: A, title: "To-Do de A", ownerId: userA, dueDate: null, meetingId: null });
    expect(await getTodo(B, todo.id)).toBeNull();
    expect(await updateTodo(B, todo.id, { title: "hackeado", description: "", ownerId: null, dueDate: null })).toBe(false);
    expect(await completeTodo(B, todo.id, true)).toBe(false);
    expect(await deleteTodo(B, todo.id)).toBe(false);
    const still = await getTodo(A, todo.id);
    expect(still?.title).toBe("To-Do de A");
    expect(still?.status).toBe("open");
  });
});

describe("Rocks e hitos", () => {
  it("otro equipo no lee, cambia ni borra la Roca ni sus hitos", async () => {
    const rock = await createRock({ teamId: A, ownerId: userA, title: "Roca de A", description: "", isCompanyRock: false, quarter: 1, year: 2026, dueDate: null });
    const ms = await addMilestone({ rockId: rock.id, title: "Hito", dueDate: null, sortOrder: 0 });
    expect(await getRock(B, rock.id)).toBeNull();
    expect(await updateRockStatus(B, rock.id, "off_track")).toBe(false);
    expect(await getMilestone(B, ms.id)).toBeNull();
    expect(await toggleMilestone(B, ms.id, true)).toBe(false);
    expect(await deleteMilestone(B, ms.id)).toBe(false);
    expect(await deleteRock(B, rock.id)).toBe(false);
    expect((await getRock(A, rock.id))?.status).toBe("on_track");
    expect((await getMilestone(A, ms.id))?.done).toBe(false);
  });
});

describe("Reuniones L10", () => {
  it("una reunión solo se encuentra desde su equipo", async () => {
    const m = await createMeeting(A, userA, null);
    expect(await getMeeting(B, m.id)).toBeNull();
    expect((await getMeeting(A, m.id))?.id).toBe(m.id);
  });
});

describe("Scorecard", () => {
  it("otro equipo no escribe valores ni metas, ni borra dueños", async () => {
    const metric = await createMetric({ teamId: A, name: "Leads", predicts: "", direction: "higher_better", format: "count", aggregation: "sum" });
    const owner = await createOwner(A, "Persona A", false);
    const ownerB = await createOwner(B, "Persona B", false);

    expect(await getMetricName(B, metric.id)).toBeNull();
    expect(await getScorecardCell(B, metric.id, owner.id)).toBeNull();
    // Mezclar un indicador de A con un dueño de B tampoco vale.
    expect(await getScorecardCell(A, metric.id, ownerB.id)).toBeNull();

    await upsertEntry({ teamId: B, metricId: metric.id, ownerId: owner.id, weekStart: "2026-01-05", value: 99, enteredBy: userB });
    await upsertEntry({ teamId: A, metricId: metric.id, ownerId: ownerB.id, weekStart: "2026-01-05", value: 98, enteredBy: userA });
    expect(await listEntries(A, ["2026-01-05"])).toHaveLength(0);

    await upsertEntry({ teamId: A, metricId: metric.id, ownerId: owner.id, weekStart: "2026-01-05", value: 7, enteredBy: userA });
    await upsertEntry({ teamId: B, metricId: metric.id, ownerId: owner.id, weekStart: "2026-01-05", value: null, enteredBy: userB });
    const entries = await listEntries(A, ["2026-01-05"]);
    expect(entries).toHaveLength(1);
    expect(Number(entries[0].value)).toBe(7);

    await setTarget(B, metric.id, owner.id, 500);
    expect(await listTargets(A)).toHaveLength(0);
    await setTarget(A, metric.id, owner.id, 10);
    expect(Number((await listTargets(A))[0].target_value)).toBe(10);

    expect(await deleteOwner(B, owner.id)).toBeNull();
    expect(await deleteOwner(A, owner.id)).toBe("Persona A");
  });
});

describe("Organigrama", () => {
  it("un puesto de otra organización no se borra", async () => {
    const { demoOrg } = await import("./helpers");
    const other = await demoOrg("Otra organización");
    const rows = (await db().sql`
      INSERT INTO accountability_seats (team_id, title) VALUES (${A}, 'Dirección') RETURNING id
    `) as { id: number }[];
    expect(await deleteSeat(other.team.id, rows[0].id)).toBe(false);
    expect((await db().sql`SELECT 1 FROM accountability_seats WHERE id = ${rows[0].id}`).length).toBe(1);
  });
});
