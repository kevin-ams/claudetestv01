import "server-only";
import { db } from "@/lib/db";
import type { Currency } from "./types";

export type MoneyByCurrency = Record<Currency, number>;

export type DashboardData = {
  contacts: number;
  companies: number;
  openDeals: number;
  openValue: MoneyByCurrency;
  weightedValue: MoneyByCurrency;
  wonThisMonth: MoneyByCurrency;
  staleDeals: number;
  funnel: { stage: string; deals: number; kind: string }[];
};

function toMoney(rows: { currency: Currency; total: string }[]): MoneyByCurrency {
  const money: MoneyByCurrency = { GTQ: 0, USD: 0 };
  for (const row of rows) money[row.currency] = Number(row.total);
  return money;
}

export const STALE_DAYS = 15;

export async function getDashboardData(pipelineId: number): Promise<DashboardData> {
  const sql = db().sql;
  const [counts, open, weighted, won, stale, funnel] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM contacts) AS contacts,
        (SELECT COUNT(*)::int FROM companies) AS companies
    `,
    sql`
      SELECT d.currency, SUM(d.amount)::text AS total, COUNT(*)::int AS n
      FROM deals d JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE s.kind = 'open' GROUP BY d.currency
    `,
    sql`
      SELECT d.currency, SUM(d.amount * s.probability / 100.0)::text AS total
      FROM deals d JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE s.kind = 'open' GROUP BY d.currency
    `,
    sql`
      SELECT d.currency, SUM(d.amount)::text AS total
      FROM deals d JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE s.kind = 'won' AND d.closed_at >= date_trunc('month', NOW())
      GROUP BY d.currency
    `,
    sql`
      SELECT COUNT(*)::int AS n
      FROM deals d JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE s.kind = 'open' AND d.last_activity_at < NOW() - make_interval(days => ${STALE_DAYS})
    `,
    sql`
      SELECT s.name AS stage, s.kind, COUNT(d.id)::int AS deals
      FROM pipeline_stages s LEFT JOIN deals d ON d.stage_id = s.id
      WHERE s.pipeline_id = ${pipelineId}
      GROUP BY s.id ORDER BY s.position
    `,
  ]);

  const c = counts[0] as { contacts: number; companies: number };
  const openRows = open as { currency: Currency; total: string; n: number }[];

  return {
    contacts: c.contacts,
    companies: c.companies,
    openDeals: openRows.reduce((sum, r) => sum + r.n, 0),
    openValue: toMoney(openRows),
    weightedValue: toMoney(weighted as { currency: Currency; total: string }[]),
    wonThisMonth: toMoney(won as { currency: Currency; total: string }[]),
    staleDeals: (stale[0] as { n: number }).n,
    funnel: funnel as DashboardData["funnel"],
  };
}
