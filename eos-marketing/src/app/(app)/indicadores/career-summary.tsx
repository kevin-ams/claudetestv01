import Link from "next/link";
import type { PublicUser } from "@/lib/domain/types";
import {
  budgetTone,
  careerLabel,
  costPerLead,
  leadsTone,
  money,
  num,
  pct,
  totalsFor,
  TONE_CLASS,
  type CareerRow,
} from "@/lib/domain/careers-shared";

function Tile({
  label,
  value,
  detail,
  tone = "none",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div className={`rounded-lg border border-border p-3 ${tone === "none" ? "bg-card" : TONE_CLASS[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {detail && <p className="text-xs opacity-80">{detail}</p>}
    </div>
  );
}

export function SummaryTiles({ rows }: { rows: CareerRow[] }) {
  const t = totalsFor(rows);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Leads"
        value={t.hasLeads ? num(t.leads) : "—"}
        detail={`Meta ${num(t.leadsGoal)} · ${pct(t.hasLeads ? t.leads : null, t.leadsGoal)}`}
        tone={t.hasLeads ? leadsTone(t.leads, t.leadsGoal) : "none"}
      />
      <Tile
        label="Consumo de presupuesto"
        value={t.hasSpent ? money(t.spent) : "—"}
        detail={`Plan ${money(t.budgetGoal)} · ${pct(t.hasSpent ? t.spent : null, t.budgetGoal)}`}
        tone={t.hasSpent ? budgetTone(t.spent, t.budgetGoal) : "none"}
      />
      <Tile
        label="Costo por lead"
        value={costPerLead(t.hasSpent ? t.spent : null, t.leads)}
        detail={`${t.careers} carreras`}
      />
      <Tile
        label="Carreras a revisar"
        value={String(t.leadsRed)}
        detail={`en leads · ${t.budgetRed} en presupuesto`}
        tone={t.leadsRed > 0 ? "red" : "none"}
      />
    </div>
  );
}

type Group = { key: string; label: string; rows: CareerRow[] };

export function groupRows(rows: CareerRow[], by: "owner" | "program", members: PublicUser[]): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = by === "owner" ? String(r.owner_id ?? "none") : r.program;
    const label =
      by === "owner"
        ? (members.find((m) => m.id === r.owner_id)?.name ?? "Sin responsable")
        : r.program;
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function GroupTable({
  rows,
  by,
  members,
}: {
  rows: CareerRow[];
  by: "owner" | "program";
  members: PublicUser[];
}) {
  const groups = groupRows(rows, by, members);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-2">{by === "owner" ? "Responsable" : "Programa"}</th>
            <th className="px-2 text-right">Carreras</th>
            <th className="px-2 text-right">Leads / Meta</th>
            <th className="px-2 text-right">%</th>
            <th className="px-2 text-right">Consumo / Plan</th>
            <th className="px-2 text-right">%</th>
            <th className="px-2 text-right">A revisar</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const t = totalsFor(g.rows);
            const leads = t.hasLeads ? t.leads : null;
            const spent = t.hasSpent ? t.spent : null;
            return (
              <tr key={g.key} className="border-b border-border last:border-0">
                <td className="py-2 pr-2 font-medium">{g.label}</td>
                <td className="px-2 text-right">{t.careers}</td>
                <td className="px-2 text-right tabular-nums">
                  {num(leads)} / {num(t.leadsGoal)}
                </td>
                <td className="px-2 text-right">
                  <span className={`badge ${TONE_CLASS[leadsTone(leads, t.leadsGoal)]}`}>
                    {pct(leads, t.leadsGoal)}
                  </span>
                </td>
                <td className="px-2 text-right tabular-nums">
                  {money(spent)} / {money(t.budgetGoal)}
                </td>
                <td className="px-2 text-right">
                  <span className={`badge ${TONE_CLASS[budgetTone(spent, t.budgetGoal)]}`}>
                    {pct(spent, t.budgetGoal)}
                  </span>
                </td>
                <td className={`px-2 text-right ${t.leadsRed > 0 ? "font-semibold text-red" : "text-muted"}`}>
                  {t.leadsRed}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Vista resumida para el segmento de Scorecard de la reunión L10. */
export function CareerSummary({
  rows,
  members,
  weekLabel,
  week,
}: {
  rows: CareerRow[];
  members: PublicUser[];
  weekLabel: string;
  week: string;
}) {
  if (rows.length === 0) return null;

  const hasLeads = rows.some((r) => r.leads !== null);
  const offTrack = rows
    .filter(() => hasLeads)
    .filter((r) => leadsTone(r.leads ?? 0, r.leads_goal) === "red")
    .sort((a, b) => (a.leads ?? 0) / a.leads_goal - (b.leads ?? 0) / b.leads_goal)
    .slice(0, 8);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">Indicadores de carrera · {weekLabel}</h3>
        <Link href={`/indicadores?semana=${week}`} className="text-sm font-medium text-primary underline">
          Ver detalle →
        </Link>
      </div>
      <SummaryTiles rows={rows} />
      <div className="card p-4">
        <GroupTable rows={rows} by="owner" members={members} />
      </div>
      {offTrack.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">
            Carreras más lejos de su meta de leads (candidatas a Issue)
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {offTrack.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {careerLabel(r)}{" "}
                  <span className="text-xs text-muted">
                    · {members.find((m) => m.id === r.owner_id)?.name ?? "Sin responsable"}
                  </span>
                </span>
                <span className="tabular-nums text-red">
                  {num(r.leads ?? 0)} / {num(r.leads_goal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
