import "server-only";
import { addDays, format, parseISO, startOfQuarter, endOfQuarter } from "date-fns";
import { db } from "@/lib/db";
import { lastClosedWeek, shiftWeek, currentQuarter } from "@/lib/utils/dates";
import { addTeamMember } from "./users";
import { seedNewTeam } from "./teams";
import { seedMarketingTeam } from "./marketing-seed";
import { listCareers } from "./careers";
import { prorateWeeklyGoals } from "./careers-shared";
import { listControlMilestones } from "./control-milestones";
import { removeTeamImages } from "./announcements";
import type { CareerMonthlyGoal, Team } from "./types";
import type { RosterName } from "./careers-catalog";

export const DEMO_EMAIL_DOMAIN = "demo.local";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Generador pseudoaleatorio con semilla: la demo sale igual cada vez. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function getDemoTeamFor(userId: number): Promise<Team | null> {
  const rows = (await db().sql`
    SELECT * FROM teams WHERE is_demo = TRUE AND demo_owner_id = ${userId} ORDER BY id DESC LIMIT 1
  `) as Team[];
  return rows[0] ?? null;
}

/** Primer equipo real (no demo) de la persona, para regresar al salir de la demo. */
export async function realTeamFor(userId: number): Promise<{ id: number; name: string } | null> {
  const rows = (await db().sql`
    SELECT t.id, t.name FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ${userId} AND t.is_demo = FALSE
    ORDER BY t.id ASC LIMIT 1
  `) as { id: number; name: string }[];
  return rows[0] ?? null;
}

/** Borra la demo de la persona: el equipo (en cascada, todos sus datos) y sus usuarios ficticios. */
export async function deleteDemoFor(userId: number) {
  const teams = (await db().sql`
    SELECT id FROM teams WHERE is_demo = TRUE AND demo_owner_id = ${userId}
  `) as { id: number }[];
  for (const t of teams) {
    await removeTeamImages(t.id);
    await db().sql`DELETE FROM teams WHERE id = ${t.id}`;
  }
  // Usuarios ficticios que ya no pertenecen a ningún equipo.
  await db().sql`
    DELETE FROM users
    WHERE email LIKE ${"%@" + DEMO_EMAIL_DOMAIN}
      AND id NOT IN (SELECT user_id FROM team_members)
  `;
}

/** Paso 1 de la demo: el equipo, sus personas y las carreras. Devuelve el id del equipo. */
export async function createDemoTeam(userId: number, realTeamName: string): Promise<number> {
  await deleteDemoFor(userId);
  const rows = (await db().sql`
    INSERT INTO teams (name, is_demo, demo_owner_id)
    VALUES (${`${realTeamName} · DEMO`}, TRUE, ${userId})
    RETURNING id
  `) as { id: number }[];
  const teamId = rows[0].id;
  await seedNewTeam(teamId);
  await addTeamMember(teamId, userId, "Dirección de marketing");
  await seedMarketingTeam(teamId, DEMO_EMAIL_DOMAIN);
  return teamId;
}

type DemoContext = Awaited<ReturnType<typeof demoContext>>;

/** Datos comunes a todos los pasos (personas, semanas, trimestre) y azar con semilla. */
async function demoContext(teamId: number, seed: number) {
  const rand = rng(seed);
  const members = (await db().sql`
    SELECT u.id, u.name FROM users u JOIN team_members tm ON tm.user_id = u.id WHERE tm.team_id = ${teamId}
  `) as { id: number; name: string }[];
  const people = new Map<string, number>(
    members.map((m) => [m.name.trim().split(/\s+/)[0].toLowerCase(), m.id])
  );
  const today = new Date();
  const lastWeek = lastClosedWeek();
  const { quarter, year } = currentQuarter();
  return {
    teamId,
    rand,
    pick: <T,>(list: T[]) => list[Math.floor(rand() * list.length)],
    between: (min: number, max: number) => min + rand() * (max - min),
    person: (name: RosterName) => people.get(name.toLowerCase()) ?? null,
    today,
    todayIso: iso(today),
    lastWeek,
    weeks: Array.from({ length: 12 }, (_, i) => shiftWeek(lastWeek, i - 11)),
    quarter,
    year,
    ownerNames: ["Kevin", "Lucero", "Luis", "Andrea", "Patty"] as RosterName[],
  };
}

/** Inserta muchas filas en una sola consulta (mucho más rápido que una por una). */
async function insertMany(table: string, columns: string[], types: string[], rows: unknown[][]) {
  if (rows.length === 0) return;
  const cols = columns.map((_, i) => rows.map((r) => r[i]));
  const selects = types.map((t, i) => `$${i + 1}::${t}[]`).join(", ");
  await db().query(`INSERT INTO ${table} (${columns.join(", ")}) SELECT * FROM unnest(${selects})`, cols);
}

async function seedIndicators(ctx: DemoContext) {
  const { teamId, rand, between, weeks } = ctx;
  // --- Indicadores y metas de carrera -------------------------------------
  const careers = await listCareers(teamId);
  const firstMonth = parseISO(`${weeks[0].slice(0, 7)}-01`);
  const months = Array.from({ length: 7 }, (_, i) => iso(new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1)));

  const baseLeads: Record<string, [number, number]> = {
    Pregrado: [60, 150],
    Postgrado: [25, 75],
    Técnico: [20, 55],
    Diplomado: [15, 40],
  };
  const goals: CareerMonthlyGoal[] = [];
  const performance = new Map<number, number>(); // qué tan bien le va a cada carrera
  for (const career of careers) {
    const [min, max] = baseLeads[career.level] ?? [20, 60];
    const monthly = Math.round(between(min, max));
    const cpl = between(5, 11); // costo por lead en US$
    performance.set(career.id, rand() < 0.25 ? between(0.55, 0.8) : between(0.85, 1.2));
    months.forEach((m, i) => {
      const seasonal = 1 + 0.08 * Math.sin(i);
      const leads = Math.round(monthly * seasonal);
      goals.push({ career_id: career.id, month: m, leads_goal: leads, budget_goal: Math.round(leads * cpl) });
    });
  }
  await insertMany(
    "career_monthly_goals",
    ["career_id", "month", "leads_goal", "budget_goal"],
    ["int", "date", "numeric", "numeric"],
    goals.map((g) => [g.career_id, g.month, g.leads_goal, g.budget_goal])
  );
  const weeklyRows: unknown[][] = [];
  for (const w of weeks) {
    const weekly = prorateWeeklyGoals(w, goals);
    for (const career of careers) {
      const goal = weekly[career.id] ?? { leads: 0, budget: 0 };
      const perf = performance.get(career.id)!;
      const leads = Math.max(0, Math.round(goal.leads * perf * between(0.8, 1.2)));
      const spent = Math.round(goal.budget * between(0.8, 1.15) * 100) / 100;
      weeklyRows.push([career.id, w, leads, "manual", spent, "csv"]);
    }
  }
  await insertMany(
    "career_weekly",
    ["career_id", "week_start", "leads", "leads_source", "budget_spent", "budget_source"],
    ["int", "date", "int", "text", "numeric", "text"],
    weeklyRows
  );
  for (const w of weeks.slice(-3)) {
    await db().sql`
      INSERT INTO career_imports (team_id, kind, week_start, file_name, careers_updated, total)
      VALUES (${teamId}, 'budget_csv', ${w}, ${`reporte-meta-${w}.csv`}, ${careers.length}, ${Math.round(between(7500, 9500))})
    `;
  }
}

async function seedScorecard(ctx: DemoContext) {
  const { teamId, between, person, weeks, ownerNames } = ctx;
  // --- Scorecard ------------------------------------------------------------
  const ownerIds: number[] = [];
  for (const [i, name] of ownerNames.entries()) {
    const r = (await db().sql`
      INSERT INTO scorecard_owners (team_id, name, user_id, is_rollup, sort_order)
      VALUES (${teamId}, ${name}, ${person(name)}, FALSE, ${i}) RETURNING id
    `) as { id: number }[];
    ownerIds.push(r[0].id);
  }
  const rollup = (await db().sql`
    INSERT INTO scorecard_owners (team_id, name, is_rollup, sort_order)
    VALUES (${teamId}, 'Equipo', TRUE, 99) RETURNING id
  `) as { id: number }[];
  const metrics = [
    { name: "Leads recibidos", predicts: "Inscripciones del próximo período", direction: "higher_better", format: "count", aggregation: "sum", target: 260, spread: 0.3 },
    { name: "Costo por lead (US$)", predicts: "Eficiencia de la inversión en pauta", direction: "lower_better", format: "currency", aggregation: "average", target: 8, spread: 0.25 },
    { name: "% leads contactados en 24 h", predicts: "Conversión a entrevista con admisiones", direction: "higher_better", format: "percentage", aggregation: "average", target: 85, spread: 0.15 },
    { name: "Piezas publicadas", predicts: "Alcance orgánico y consistencia de marca", direction: "higher_better", format: "count", aggregation: "sum", target: 6, spread: 0.4 },
    { name: "Campañas activas sin errores", predicts: "Leads sin interrupciones", direction: "higher_better", format: "count", aggregation: "sum", target: 4, spread: 0.35 },
    { name: "Inscritos confirmados", predicts: "Ingresos del ciclo", direction: "higher_better", format: "count", aggregation: "sum", target: 12, spread: 0.45 },
  ] as const;
  for (const [i, m] of metrics.entries()) {
    const r = (await db().sql`
      INSERT INTO scorecard_metrics (team_id, name, predicts, direction, format, aggregation, sort_order)
      VALUES (${teamId}, ${m.name}, ${m.predicts}, ${m.direction}, ${m.format}, ${m.aggregation}, ${i}) RETURNING id
    `) as { id: number }[];
    const metricId = r[0].id;
    const rollupTarget = m.aggregation === "sum" ? m.target * ownerIds.length : m.target;
    await db().sql`INSERT INTO scorecard_targets VALUES (${metricId}, ${rollup[0].id}, ${rollupTarget})`;
    for (const ownerId of ownerIds) {
      await db().sql`INSERT INTO scorecard_targets VALUES (${metricId}, ${ownerId}, ${m.target})`;
      await insertMany(
        "scorecard_entries",
        ["metric_id", "owner_id", "week_start", "value"],
        ["int", "int", "date", "numeric"],
        weeks.map((w) => {
          const raw = m.target * between(1 - m.spread, 1 + m.spread * 0.8);
          const value = m.format === "percentage" ? Math.min(100, Math.round(raw)) : m.format === "currency" ? Math.round(raw * 100) / 100 : Math.round(raw);
          return [metricId, ownerId, w, value];
        })
      );
    }
  }
}

async function seedRocks(ctx: DemoContext) {
  const { teamId, person, today, quarter, year } = ctx;
  // --- Rocks del trimestre actual -----------------------------------------
  const qStart = startOfQuarter(today);
  const qEnd = endOfQuarter(today);
  const qDate = (fraction: number) => iso(addDays(qStart, Math.round((qEnd.getTime() - qStart.getTime()) / 864e5 * fraction)));
  const rocks: { title: string; owner: RosterName; company?: boolean; status: string; description: string; milestones: [string, number, boolean][] }[] = [
    {
      title: "Alcanzar 12,000 leads calificados en el trimestre",
      owner: "Kevin",
      company: true,
      status: "on_track",
      description: "Meta de leads de todas las carreras, con costo por lead menor a $9.",
      milestones: [["Metas por carrera aprobadas", 0.1, true], ["Campañas de admisiones activas", 0.35, true], ["Revisión de mitad de trimestre", 0.55, false], ["Cierre y reporte", 0.95, false]],
    },
    {
      title: "Lanzar la campaña de Ingenierías FISICC",
      owner: "Lucero",
      status: "on_track",
      description: "Campaña integrada (Meta, Google y correo) para las ingenierías de pregrado.",
      milestones: [["Brief validado con la facultad", 0.15, true], ["Piezas aprobadas", 0.4, true], ["Campañas publicadas", 0.6, false]],
    },
    {
      title: "Automatizar el seguimiento de leads de posgrado",
      owner: "Andrea",
      status: "off_track",
      description: "Flujos de ActiveCampaign con asignación y recordatorios para admisiones.",
      milestones: [["Mapa del embudo", 0.2, true], ["Flujos configurados", 0.5, false], ["Prueba con lead real", 0.7, false]],
    },
    {
      title: "Reducir el costo por lead de maestrías en 15%",
      owner: "Luis",
      status: "on_track",
      description: "Optimización de públicos y creatividades en Meta y Google.",
      milestones: [["Diagnóstico de campañas", 0.15, true], ["Pruebas A/B de creatividades", 0.45, true], ["Ajuste de presupuesto", 0.75, false]],
    },
    {
      title: "Relanzar las carreras de energía (IRE)",
      owner: "Patty",
      status: "off_track",
      description: "Nueva propuesta de valor y página de carrera para IRE.",
      milestones: [["Estrategia comercial aprobada", 0.25, false], ["Landing publicada", 0.6, false]],
    },
  ];
  for (const [i, r] of rocks.entries()) {
    const inserted = (await db().sql`
      INSERT INTO rocks (team_id, owner_id, title, description, is_company_rock, quarter, year, due_date, status, sort_order)
      VALUES (${teamId}, ${person(r.owner)}, ${r.title}, ${r.description}, ${Boolean(r.company)}, ${quarter}, ${year}, ${iso(qEnd)}, ${r.status}, ${i})
      RETURNING id
    `) as { id: number }[];
    for (const [j, [title, when, done]] of r.milestones.entries()) {
      await db().sql`
        INSERT INTO rock_milestones (rock_id, title, done, due_date, sort_order)
        VALUES (${inserted[0].id}, ${title}, ${done}, ${qDate(when)}, ${j})
      `;
    }
  }
}

async function seedIssuesTodos(ctx: DemoContext) {
  const { teamId, person, today } = ctx;
  // --- Issues y To-Dos -----------------------------------------------------
  const issues: [string, string, RosterName, number, "short_term" | "long_term", boolean][] = [
    ["Leads de Maestría en Data Science muy por debajo de la meta", "Tres semanas seguidas bajo el 70% de la meta.", "Luis", 5, "short_term", false],
    ["Formulario de FACTI no envía a ActiveCampaign", "Los leads llegan por correo pero no al CRM.", "Andrea", 2, "short_term", false],
    ["Falta presupuesto para la campaña de IRE", "Se necesita aprobación adicional de $2,000.", "Patty", 9, "short_term", false],
    ["Tiempo de respuesta de admisiones mayor a 48 h", "Afecta la conversión de pregrado.", "Kevin", 14, "long_term", false],
    ["Creatividades de ESEC con baja tasa de clics", "CTR de 0.4% contra 1.1% del promedio.", "Lucero", 7, "short_term", false],
    ["Definir proceso para carreras nuevas", "Checklist de lanzamiento con la unidad académica.", "Kevin", 21, "long_term", false],
    ["Píxel de Meta duplicado en la página de carreras", "Duplicaba conversiones.", "Luis", -10, "short_term", true],
    ["Correos de bienvenida sin personalizar", "Se agregaron campos por carrera.", "Andrea", -6, "short_term", true],
  ];
  for (const [i, [title, description, owner, days, term, solved]] of issues.entries()) {
    await db().sql`
      INSERT INTO issues (team_id, title, description, raised_by, owner_id, term, sort_order, due_date, status, solved_at)
      VALUES (${teamId}, ${title}, ${description}, ${person("Kevin")}, ${person(owner)}, ${term}, ${i},
              ${iso(addDays(today, days))}, ${solved ? "solved" : "open"}, ${solved ? addDays(today, days).toISOString() : null})
    `;
  }
  const todos: [string, string, RosterName, number, boolean][] = [
    ["Enviar reporte semanal de leads a decanaturas", "Incluir FISICC, FACTI y ESEC con comparativo contra la meta.", "Kevin", 2, false],
    ["Corregir integración del formulario de FACTI", "Revisar el webhook y probar con un lead de prueba.", "Andrea", 1, false],
    ["Preparar tres variaciones de anuncio para ESEC", "Formatos cuadrado y vertical; enfoque en empleabilidad.", "Lucero", 4, false],
    ["Solicitar aprobación de presupuesto IRE", "Adjuntar proyección de leads y costo por lead.", "Patty", -2, false],
    ["Revisar públicos de maestrías en Google Ads", "Excluir audiencias de pregrado.", "Luis", -1, false],
    ["Actualizar preguntas frecuentes del bot", "Nuevas fechas de inicio y becas.", "Miguel", 5, false],
    ["Agendar sesión de aprendizaje con admisiones", "Revisar motivos de no inscripción del último mes.", "Kevin", 6, false],
    ["Publicar landing de Ingeniería en Mecatrónica", "", "Lucero", -5, true],
    ["Configurar UTMs de la campaña de posgrados", "", "Luis", -8, true],
    ["Enviar newsletter de becas", "", "Andrea", -4, true],
  ];
  for (const [title, description, owner, days, done] of todos) {
    await db().sql`
      INSERT INTO todos (team_id, title, description, owner_id, due_date, status, done_at)
      VALUES (${teamId}, ${title}, ${description}, ${person(owner)}, ${iso(addDays(today, days))},
              ${done ? "done" : "open"}, ${done ? addDays(today, days).toISOString() : null})
    `;
  }
}

async function seedMeetings(ctx: DemoContext) {
  const { teamId, between, person, lastWeek, ownerNames } = ctx;
  // --- Reuniones pasadas, calificaciones y noticias -----------------------
  const headlines: [number, "customer" | "employee", string][] = [
    [0, "customer", "Récord de solicitudes para Ingeniería en Sistemas esta semana"],
    [0, "employee", "Andrea completó la certificación de ActiveCampaign"],
    [1, "customer", "La facultad de FACTI aprobó la nueva malla de Administración"],
    [2, "employee", "Nuevo proceso de revisión de piezas en 24 horas"],
  ];
  for (let i = 0; i < 3; i++) {
    const started = addDays(parseISO(lastWeek), 7 - i * 7);
    started.setHours(9, 0, 0, 0);
    const ended = new Date(started.getTime() + 88 * 60_000);
    const m = (await db().sql`
      INSERT INTO meetings (team_id, scheduled_at, status, started_at, ended_at, created_by, current_segment)
      VALUES (${teamId}, ${started.toISOString()}, 'completed', ${started.toISOString()}, ${ended.toISOString()}, ${person("Kevin")}, 'conclude')
      RETURNING id
    `) as { id: number }[];
    for (const name of ownerNames) {
      const uid = person(name);
      if (uid) await db().sql`INSERT INTO meeting_ratings VALUES (${m[0].id}, ${uid}, ${Math.round(between(7, 10))})`;
    }
    await db().sql`
      UPDATE meetings SET avg_rating = (SELECT AVG(rating) FROM meeting_ratings WHERE meeting_id = ${m[0].id}) WHERE id = ${m[0].id}
    `;
    for (const [meetingIdx, type, content] of headlines) {
      if (meetingIdx !== i) continue;
      await db().sql`
        INSERT INTO meeting_headlines (meeting_id, type, content, created_by, created_at)
        VALUES (${m[0].id}, ${type}, ${content}, ${person("Kevin")}, ${started.toISOString()})
      `;
    }
  }
}

async function seedVtoOrg(ctx: DemoContext) {
  const { teamId, person, year } = ctx;
  // --- V/TO y organigrama ---------------------------------------------------
  await db().sql`
    UPDATE vto SET
      core_values = ${JSON.stringify(["El estudiante primero", "Decisiones con datos", "Rapidez con calidad", "Colaboración con las facultades"])}::jsonb,
      core_focus = ${JSON.stringify({ purpose: "Conectar a cada aspirante con la carrera que transforma su futuro", niche: "Marketing de admisiones para pregrado y posgrado" })}::jsonb,
      ten_year_target = 'Ser el equipo de marketing educativo de referencia en la región',
      marketing_strategy = ${JSON.stringify({ target_market: "Jóvenes y profesionales de 17 a 40 años en Guatemala y Centroamérica", three_uniques: ["Datos por carrera cada semana", "Contenido validado con cada facultad", "Seguimiento de leads en 24 h"], proven_process: "Definición → Producción → Activación → Mejora continua", guarantee: "Cada lead recibe respuesta en menos de 24 horas" })}::jsonb,
      three_year_picture = ${JSON.stringify({ future_date: `${year + 3}-12-31`, revenue: "", profit: "", measurables: "60,000 leads al año · CPL < $7", looks_like: ["Dashboard en tiempo real por carrera", "Todas las carreras con embudo automatizado", "Equipo de 10 personas"] })}::jsonb,
      one_year_plan = ${JSON.stringify({ future_date: `${year}-12-31`, revenue: "", profit: "", measurables: "45,000 leads · CPL < $8", goals: ["Automatizar el seguimiento de todas las maestrías", "Lanzar 8 carreras con el proceso completo", "Reducir 15% el costo por lead"] })}::jsonb
    WHERE team_id = ${teamId}
  `;
  const head = (await db().sql`
    INSERT INTO accountability_seats (team_id, title, user_id, roles, sort_order)
    VALUES (${teamId}, 'Dirección de Marketing', ${person("Kevin")}, ${JSON.stringify(["Estrategia y metas", "Presupuesto", "Relación con facultades", "Reunión L10"])}::jsonb, 0)
    RETURNING id
  `) as { id: number }[];
  const seats: [string, RosterName, string[]][] = [
    ["Contenido y marca", "Lucero", ["Matriz de contenido", "Piezas y destinos", "Redes sociales"]],
    ["Performance y pauta", "Luis", ["Campañas Meta y Google", "Presupuesto por carrera", "Costo por lead"]],
    ["Automatización y CRM", "Andrea", ["ActiveCampaign", "Embudos y nurturing", "Calidad de datos"]],
    ["Posgrados y alianzas", "Patty", ["Carreras de posgrado", "Eventos", "Alianzas"]],
    ["Análisis y bot", "Miguel", ["Reportes semanales", "Contenido del bot", "Mejora continua"]],
  ];
  for (const [i, [title, owner, roles]] of seats.entries()) {
    await db().sql`
      INSERT INTO accountability_seats (team_id, parent_seat_id, title, user_id, roles, sort_order)
      VALUES (${teamId}, ${head[0].id}, ${title}, ${person(owner)}, ${JSON.stringify(roles)}::jsonb, ${i})
    `;
  }
}

async function seedControl(ctx: DemoContext) {
  const { teamId, rand, pick, between, today, todayIso } = ctx;
  // --- Control de carrera ---------------------------------------------------
  const careers = await listCareers(teamId);
  const milestones = await listControlMilestones(teamId);
  const labels = ["Prioridad", "Nueva", "Relanzamiento", "Bloqueada"];
  const tracked = careers.filter((_, i) => i % 5 === 0).slice(0, 24);
  for (const c of tracked) {
    const progress = Math.floor(rand() * (milestones.length + 1));
    const start = addDays(today, -Math.round(between(10, 60)));
    const status = rand() < 0.25 ? "off_track" : "on_track";
    const trackLabels = rand() < 0.5 ? [pick(labels)] : [];
    await db().sql`
      INSERT INTO career_tracks (career_id, start_date, status, labels)
      VALUES (${c.id}, ${iso(start)}, ${status}, ${JSON.stringify(trackLabels)}::jsonb)
    `;
    for (let i = 0; i < progress; i++) {
      const doneOn = iso(addDays(start, Math.min(Math.round((i + 1) * between(3, 6)), Math.round((today.getTime() - start.getTime()) / 864e5))));
      await db().sql`
        INSERT INTO career_track_milestones (career_id, milestone, done_on)
        VALUES (${c.id}, ${milestones[i].key}, ${doneOn <= todayIso ? doneOn : todayIso})
      `;
    }
  }
}

/** Pasos de la demo, en orden. El 0 (equipo y carreras) lo hace createDemoTeam. */
export const DEMO_STEPS = [
  { label: "Creando equipo y carreras", run: null },
  { label: "Generando metas e indicadores de 12 semanas", run: seedIndicators },
  { label: "Armando el Scorecard", run: seedScorecard },
  { label: "Creando Rocks del trimestre", run: seedRocks },
  { label: "Agregando Issues y To-Dos", run: seedIssuesTodos },
  { label: "Registrando reuniones y noticias", run: seedMeetings },
  { label: "Completando V/TO y organigrama", run: seedVtoOrg },
  { label: "Preparando Control de carrera", run: seedControl },
] as const;

export async function runDemoStep(teamId: number, step: number) {
  const def = DEMO_STEPS[step];
  if (!def?.run) throw new Error("Paso de demo inválido");
  await def.run(await demoContext(teamId, 20260924 + step));
}
