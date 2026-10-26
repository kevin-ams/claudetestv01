"use client";

import { ArrowRight, ChevronDown, ChevronRight } from "@gravity-ui/icons";
import { Button, Chip, Input } from "@heroui/react";
import { Fragment, useState } from "react";
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
  TONE_CHIP,
  type CareerRow,
} from "@/lib/domain/careers-shared";

/** Carreras de una persona agrupadas por facultad (programa), en orden alfabético. */
function byProgram(rows: CareerRow[]): [string, CareerRow[]][] {
  const map = new Map<string, CareerRow[]>();
  for (const r of rows) map.set(r.program, [...(map.get(r.program) ?? []), r]);
  return [...map].sort((a, b) => (a[0] || "~").localeCompare(b[0] || "~", "es"));
}

/** Todas las carreras con sus indicadores de la semana, agrupadas por responsable y facultad. */
export function CareersByOwner({
  rows,
  members,
  onRaiseIssue,
}: {
  rows: CareerRow[];
  members: PublicUser[];
  onRaiseIssue?: (row: CareerRow) => void;
}) {
  const nameOf = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin responsable";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => `${careerLabel(r)} ${r.program} ${nameOf(r.owner_id)}`.toLowerCase().includes(q)) : rows;

  const groups = [...new Map(filtered.map((r) => [r.owner_id ?? 0, null])).keys()]
    .map((id) => ({
      id,
      name: nameOf(id || null),
      rows: filtered.filter((r) => (r.owner_id ?? 0) === id).sort((a, b) => careerLabel(a).localeCompare(careerLabel(b), "es")),
    }))
    // Por nombre; "Sin responsable" al final.
    .sort((a, b) => Number(a.id === 0) - Number(b.id === 0) || a.name.localeCompare(b.name, "es"));

  const [closed, setClosed] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allClosed = groups.length > 0 && groups.every((g) => closed.has(g.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar carrera" placeholder="Buscar carrera, programa o persona…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-64" />
        <Button size="sm" variant="ghost" onPress={() => setClosed(allClosed ? new Set() : new Set(groups.map((g) => g.id)))}>
          {allClosed ? "Expandir todo" : "Contraer todo"}
        </Button>
        <span className="text-xs text-muted">
          {filtered.length} carreras · {groups.length} personas
        </span>
      </div>
      {/* Área con su propio scroll: el encabezado queda fijo arriba mientras se recorren las carreras. */}
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="bg-card py-2 pl-2 pr-2">Persona · facultad · carrera</th>
              <th className="bg-card px-2 text-right">Leads</th>
              <th className="bg-card px-2 text-right">Meta</th>
              <th className="bg-card px-2 text-right">%</th>
              <th className="bg-card px-2 text-right">Consumo</th>
              <th className="bg-card px-2 text-right">Plan</th>
              <th className="bg-card px-2 text-right">%</th>
              <th className="bg-card px-2 text-right">Costo / lead</th>
              {onRaiseIssue && <th className="w-20 bg-card px-2" />}
            </tr>
          </thead>
          {groups.map((g) => {
            const t = totalsFor(g.rows);
            const leads = t.hasLeads ? t.leads : null;
            const spent = t.hasSpent ? t.spent : null;
            const open = !closed.has(g.id);
            return (
              <tbody key={g.id} className="border-b-2 border-border last:border-0">
                <tr className="cursor-pointer bg-background/70 font-semibold hover:bg-background" onClick={() => toggle(g.id)}>
                  <td className="py-2 pl-2 pr-2">
                    <span className="inline-flex items-center gap-1">
                      {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                      {g.name}
                      <span className="text-xs font-normal text-muted">
                        · {t.careers} carreras{t.leadsRed ? ` · ${t.leadsRed} a revisar` : ""}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 text-right tabular-nums">{num(leads)}</td>
                  <td className="px-2 text-right tabular-nums">{num(t.leadsGoal)}</td>
                  <td className="px-2 text-right">
                    <Chip size="sm" variant="soft" color={TONE_CHIP[leadsTone(leads, t.leadsGoal)]}>
                      {pct(leads, t.leadsGoal)}
                    </Chip>
                  </td>
                  <td className="px-2 text-right tabular-nums">{money(spent)}</td>
                  <td className="px-2 text-right tabular-nums">{money(t.budgetGoal)}</td>
                  <td className="px-2 text-right">
                    <Chip size="sm" variant="soft" color={TONE_CHIP[budgetTone(spent, t.budgetGoal)]}>
                      {pct(spent, t.budgetGoal)}
                    </Chip>
                  </td>
                  <td className="px-2 text-right tabular-nums">{costPerLead(spent, t.leads)}</td>
                  {onRaiseIssue && <td />}
                </tr>
                {open &&
                  byProgram(g.rows).map(([program, rows]) => {
                    const pt = totalsFor(rows);
                    const pl = pt.hasLeads ? pt.leads : null;
                    const ps = pt.hasSpent ? pt.spent : null;
                    return (
                      <Fragment key={program}>
                        <tr className="border-t border-border/60 bg-background/30 text-xs font-semibold text-muted">
                          <td className="py-1.5 pl-6 pr-2 uppercase tracking-wide">
                            {program || "Sin facultad"} <span className="font-normal normal-case">· {rows.length}</span>
                          </td>
                          <td className="px-2 text-right tabular-nums">{num(pl)}</td>
                          <td className="px-2 text-right tabular-nums">{num(pt.leadsGoal)}</td>
                          <td className="px-2 text-right tabular-nums">{pct(pl, pt.leadsGoal)}</td>
                          <td className="px-2 text-right tabular-nums">{money(ps)}</td>
                          <td className="px-2 text-right tabular-nums">{money(pt.budgetGoal)}</td>
                          <td className="px-2 text-right tabular-nums">{pct(ps, pt.budgetGoal)}</td>
                          <td className="px-2 text-right tabular-nums">{costPerLead(ps, pt.leads)}</td>
                          {onRaiseIssue && <td />}
                        </tr>
                        {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-1.5 pl-10 pr-2">{careerLabel(r)}</td>
                      <td className="px-2 text-right tabular-nums">
                        {num(r.leads)}
                        {r.leads_source === "activecampaign" && <span className="ml-1 text-[10px] text-muted">AC</span>}
                      </td>
                      <td className="px-2 text-right tabular-nums text-muted">{num(r.leads_goal)}</td>
                      <td className="px-2 text-right">
                        <Chip size="sm" variant="soft" color={TONE_CHIP[leadsTone(r.leads, r.leads_goal)]}>
                          {pct(r.leads, r.leads_goal)}
                        </Chip>
                      </td>
                      <td className="px-2 text-right tabular-nums">{money(r.budget_spent)}</td>
                      <td className="px-2 text-right tabular-nums text-muted">{money(r.budget_goal)}</td>
                      <td className="px-2 text-right">
                        <Chip size="sm" variant="soft" color={TONE_CHIP[budgetTone(r.budget_spent, r.budget_goal)]}>
                          {pct(r.budget_spent, r.budget_goal)}
                        </Chip>
                      </td>
                      <td className="px-2 text-right tabular-nums">{costPerLead(r.budget_spent, r.leads ?? 0)}</td>
                      {onRaiseIssue && (
                        <td className="px-2 text-right">
                          {leadsTone(r.leads, r.leads_goal) === "red" && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] text-red" onPress={() => onRaiseIssue(r)}>
                              <ArrowRight width={12} height={12} aria-hidden /> Issue
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                        ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
