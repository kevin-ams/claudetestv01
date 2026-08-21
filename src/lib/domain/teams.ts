import "server-only";
import { db } from "@/lib/db";
import type { Team } from "./types";

export async function createTeam(name: string): Promise<Team> {
  const rows = await db().sql`
    INSERT INTO teams (name) VALUES (${name}) RETURNING *
  `;
  return rows[0] as Team;
}

export async function getTeam(id: number): Promise<Team | null> {
  const rows = await db().sql`SELECT * FROM teams WHERE id = ${id}`;
  return (rows[0] as Team) ?? null;
}

export async function renameTeam(id: number, name: string) {
  await db().sql`UPDATE teams SET name = ${name} WHERE id = ${id}`;
}

/**
 * Seed a brand-new team with an empty V/TO and the scorecard structure
 * (indicators, owners, and goals) migrated from the customer's original
 * spreadsheet, so the team has something real to work with on day one.
 */
export async function seedNewTeam(teamId: number) {
  await db().sql`
    INSERT INTO vto (team_id) VALUES (${teamId})
    ON CONFLICT (team_id) DO NOTHING
  `;

  const ownerRows = await db().sql`
    INSERT INTO scorecard_owners (team_id, name, is_rollup, sort_order)
    VALUES
      (${teamId}, 'Cesar', false, 0),
      (${teamId}, 'David', false, 1),
      (${teamId}, 'General', true, 2)
    RETURNING id, name
  `;
  const ownerIdByName = new Map<string, number>(
    (ownerRows as { id: number; name: string }[]).map((o) => [o.name, o.id])
  );

  const metrics: {
    name: string;
    predicts: string;
    direction: "higher_better" | "lower_better";
    format: "count" | "percentage";
    aggregation: "sum" | "average";
    targets: { Cesar: number; David: number; General: number };
  }[] = [
    {
      name: "Cadencia: piezas publicadas / semana",
      predicts: "Volumen y consistencia mensual",
      direction: "higher_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 5, David: 4, General: 9 },
    },
    {
      name: "Hero producidas / semana",
      predicts: "Notoriedad e impacto de marca",
      direction: "higher_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 1, David: 1, General: 1 },
    },
    {
      name: "Hub producidas / semana",
      predicts: "Comunidad y engagement",
      direction: "higher_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 2, David: 2, General: 5 },
    },
    {
      name: "Hygiene producidas / semana",
      predicts: "Trafico organico (SEO)",
      direction: "higher_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 1, David: 1, General: 3 },
    },
    {
      name: "% Hygiene sobre el total de la semana",
      predicts: "Que no se rompa el piso SEO (>=25%)",
      direction: "higher_better",
      format: "percentage",
      aggregation: "average",
      targets: { Cesar: 25, David: 25, General: 25 },
    },
    {
      name: "% piezas con CTA + enlace a carrera",
      predicts: "Clics a carreras / leads / admisiones",
      direction: "higher_better",
      format: "percentage",
      aggregation: "average",
      targets: { Cesar: 100, David: 100, General: 100 },
    },
    {
      name: "% eventos con nota previa >= 2 semanas antes",
      predicts: "Inscripciones a eventos",
      direction: "higher_better",
      format: "percentage",
      aggregation: "average",
      targets: { Cesar: 100, David: 100, General: 100 },
    },
    {
      name: "% piezas distribuidas en 3 canales",
      predicts: "Alcance en redes",
      direction: "higher_better",
      format: "percentage",
      aggregation: "average",
      targets: { Cesar: 100, David: 100, General: 100 },
    },
    {
      name: "Piezas sin distribuir al cierre de semana",
      predicts: "Alcance no desperdiciado",
      direction: "lower_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 1, David: 1, General: 2 },
    },
    {
      name: "Coberturas realizadas",
      predicts: "Cantidad de coberturas semanal",
      direction: "higher_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 2, David: 2, General: 4 },
    },
    {
      name: "Buffer esporadico usado / semana",
      predicts: "Ritmo planificado protegido",
      direction: "lower_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 2, David: 2, General: 3 },
    },
    {
      name: "% piezas etiquetadas (pilar + capa)",
      predicts: "Medicion estrategica por pilar",
      direction: "higher_better",
      format: "percentage",
      aggregation: "average",
      targets: { Cesar: 100, David: 100, General: 100 },
    },
    {
      name: "Tiempo en coberturas fuera de horario",
      predicts: "Ritmo de coberturas",
      direction: "lower_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 0, David: 0, General: 0 },
    },
    {
      name: "Tiempo de reposicion pendiente",
      predicts: "No acumular horas",
      direction: "lower_better",
      format: "count",
      aggregation: "sum",
      targets: { Cesar: 4, David: 4, General: 4 },
    },
  ];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    const rows = await db().sql`
      INSERT INTO scorecard_metrics (team_id, name, predicts, direction, format, aggregation, sort_order)
      VALUES (${teamId}, ${m.name}, ${m.predicts}, ${m.direction}, ${m.format}, ${m.aggregation}, ${i})
      RETURNING id
    `;
    const metricId = (rows[0] as { id: number }).id;

    for (const ownerName of ["Cesar", "David", "General"] as const) {
      const ownerId = ownerIdByName.get(ownerName)!;
      await db().sql`
        INSERT INTO scorecard_targets (metric_id, owner_id, target_value)
        VALUES (${metricId}, ${ownerId}, ${m.targets[ownerName]})
      `;
    }
  }
}
