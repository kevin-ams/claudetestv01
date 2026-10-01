import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createTeam, seedNewTeam } from "./teams";
import { addTeamMember, createUser, getUserByEmail, listTeamMembers } from "./users";
import { ADMIN_ROLE } from "./roles";
import { placeholderEmail } from "./marketing-seed";
import { createMetric, createOwner, setTarget } from "./scorecard";
import { ensureOptions } from "./editorial";
import type { Aggregation, Direction, MetricFormat } from "./types";
import SEED from "./ges-seed.json";

/**
 * Equipo "Comunicación GES" a partir del Plan de contenido (Calendario Ag-Sept,
 * Coberturas, Días internacionales, Banco Hygiene) y del Scorecard multi-pestaña
 * (Config + Cesar + David). Los datos se extrajeron de las hojas de Google.
 */
export const GES_TEAM_NAME = "Comunicación GES";
const EDITORS = ["Cesar", "David"] as const;
const EMAIL_DOMAIN = "comunicacion-ges.local";

type Seed = {
  pieces: {
    week: string;
    date: string | null;
    title: string;
    pilar: string;
    capa: string;
    assignee: string;
    frente: string;
    audiencia: string;
    facultad: string;
    cta: string;
    status: string;
    note: string;
    buffer: boolean;
  }[];
  bank: { title: string; pilar: string; capa: string; status: string; assignee: string }[];
  dates: { date: string | null; title: string; facultad: string; carrera: string; pilar: string; capa: string; angle: string; priority: string; note: string }[];
  coverages: {
    date: string | null;
    title: string;
    facultad: string;
    start: string;
    end: string;
    assignee: string;
    tipo: string;
    status: string;
    paquete: string;
    est: string;
    real: number | null;
    over: number;
    replaced: number;
    notes: string;
  }[];
  metrics: {
    name: string;
    predicts: string;
    direction: Direction;
    aggregation: Aggregation;
    format: MetricFormat;
    targets: Record<"Cesar" | "David" | "General", number>;
  }[];
  entries: { metric: string; owner: "Cesar" | "David"; week: string; value: number }[];
};

const data = SEED as Seed;

export async function findGesTeam(userId: number): Promise<number | null> {
  const rows = await db().sql`
    SELECT t.id FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ${userId} AND t.name = ${GES_TEAM_NAME} LIMIT 1
  `;
  return (rows[0] as { id: number } | undefined)?.id ?? null;
}

export type GesImportResult = {
  teamId: number;
  created: { name: string; email: string }[];
  counts: { metrics: number; entries: number; pieces: number; bank: number; dates: number; coverages: number };
};

async function insertRows(table: string, columns: string[], teamId: number, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const cols = columns.join(", ");
  await db().query(
    `INSERT INTO ${table} (team_id, ${cols})
     SELECT $1, ${columns.map((c) => `x.${c}`).join(", ")} FROM json_populate_recordset(NULL::${table}, $2::json) AS x`,
    [teamId, JSON.stringify(rows)]
  );
}

/**
 * Crea el equipo con quien importa (Administrador), Cesar y David (correo
 * provisional; el administrador define su acceso real en Ajustes › Equipo),
 * los 16 indicadores con sus metas y valores semanales, el calendario, el
 * banco de ideas, las fechas clave y el registro de coberturas.
 */
export async function importComunicacionGes(admin: { userId: number; teamId: number }): Promise<GesImportResult> {
  const team = await createTeam(GES_TEAM_NAME);
  await seedNewTeam(team.id);
  await addTeamMember(team.id, admin.userId, "Coordinación de Comunicación", ADMIN_ROLE);

  // "Yo, Kevin": si quien importa no es Kevin, también se suma el Kevin del equipo actual.
  const current = await listTeamMembers(admin.teamId);
  const kevin = current.find((m) => m.name.trim().split(/\s+/)[0]?.toLowerCase() === "kevin");
  if (kevin && kevin.id !== admin.userId) await addTeamMember(team.id, kevin.id, "Coordinación de Comunicación", ADMIN_ROLE);

  const created: GesImportResult["created"] = [];
  const userIds = new Map<string, number>();
  for (const name of EDITORS) {
    const email = placeholderEmail(name, EMAIL_DOMAIN);
    let user = await getUserByEmail(email);
    if (!user) {
      const u = await createUser({ name, email, password: randomBytes(24).toString("hex"), role: "member" });
      user = { ...u, password_hash: "" };
      created.push({ name, email });
    }
    await addTeamMember(team.id, user.id, "Editor(a) de contenido");
    userIds.set(name, user.id);
  }
  const who = (name: string) => userIds.get(name.trim()) ?? null;

  // ---- Scorecard: dueños (Cesar, David y General como total) ----
  const ownerIds = new Map<string, number>();
  for (const name of EDITORS) {
    const o = await createOwner(team.id, name, false);
    await db().sql`UPDATE scorecard_owners SET user_id = ${who(name)} WHERE id = ${o.id}`;
    ownerIds.set(name, o.id);
  }
  ownerIds.set("General", (await createOwner(team.id, "General", true)).id);

  const metricIds = new Map<string, number>();
  for (const m of data.metrics) {
    const metric = await createMetric({
      teamId: team.id,
      name: m.name,
      predicts: m.predicts,
      direction: m.direction,
      format: m.format,
      aggregation: m.aggregation,
    });
    metricIds.set(m.name, metric.id);
    for (const [owner, value] of Object.entries(m.targets)) {
      if (value !== null && value !== undefined) await setTarget(metric.id, ownerIds.get(owner)!, Number(value));
    }
  }
  const entries = data.entries
    .filter((e) => metricIds.has(e.metric))
    .map((e) => ({
      metric_id: metricIds.get(e.metric),
      owner_id: ownerIds.get(e.owner),
      week_start: e.week,
      value: e.value,
      entered_by: admin.userId,
    }));
  if (entries.length) {
    await db().query(
      `INSERT INTO scorecard_entries (metric_id, owner_id, week_start, value, entered_by)
       SELECT x.metric_id, x.owner_id, x.week_start, x.value, x.entered_by
       FROM json_populate_recordset(NULL::scorecard_entries, $1::json) AS x
       ON CONFLICT (metric_id, owner_id, week_start) DO NOTHING`,
      [JSON.stringify(entries)]
    );
  }

  // ---- Calendario editorial, banco, fechas clave y coberturas ----
  await ensureOptions(team.id);
  const pieceCols = ["week_start", "pub_date", "title", "pilar", "capa", "assignee_id", "frente", "audiencia", "facultad", "cta", "status", "note", "is_buffer"];
  await insertRows(
    "editorial_pieces",
    pieceCols,
    team.id,
    [
      ...data.pieces.map((p) => ({
        week_start: p.week,
        pub_date: p.date,
        title: p.title,
        pilar: p.pilar,
        capa: p.capa,
        assignee_id: who(p.assignee),
        frente: p.frente,
        audiencia: p.audiencia,
        facultad: p.facultad,
        cta: p.cta,
        status: p.status,
        note: p.note,
        is_buffer: p.buffer,
      })),
      ...data.bank.map((b) => ({
        week_start: null,
        pub_date: null,
        title: b.title,
        pilar: b.pilar,
        capa: b.capa,
        assignee_id: who(b.assignee),
        frente: "",
        audiencia: "",
        facultad: "",
        cta: "",
        status: b.status,
        note: "Banco Hygiene",
        is_buffer: false,
      })),
    ]
  );
  const dates = data.dates.filter((d) => d.date);
  await insertRows("editorial_dates", ["date", "title", "facultad", "carrera", "pilar", "capa", "angle", "priority", "note"], team.id, dates);
  await insertRows(
    "coverages",
    ["date", "title", "facultad", "start_time", "end_time", "assignee_id", "tipo", "status", "paquete", "est_hours", "real_hours", "overtime_hours", "replaced_hours", "notes"],
    team.id,
    data.coverages.map((c) => ({
      date: c.date,
      title: c.title,
      facultad: c.facultad,
      start_time: c.start,
      end_time: c.end,
      assignee_id: who(c.assignee),
      tipo: c.tipo,
      status: c.status,
      paquete: c.paquete,
      est_hours: c.est,
      real_hours: c.real,
      overtime_hours: c.over,
      replaced_hours: c.replaced,
      notes: c.notes,
    }))
  );

  return {
    teamId: team.id,
    created,
    counts: {
      metrics: metricIds.size,
      entries: entries.length,
      pieces: data.pieces.length,
      bank: data.bank.length,
      dates: dates.length,
      coverages: data.coverages.length,
    },
  };
}
