"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Career, CareerMonthlyGoal, PublicUser } from "@/lib/domain/types";
import { money, normalizeText, num } from "@/lib/domain/careers-shared";
import { copyMonthAction, setMonthlyGoalAction, type GoalField } from "./actions";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function GoalCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number | null) => Promise<void>;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(value ? String(value) : "");
  const [synced, setSynced] = useState(value);
  const [pending, startTransition] = useTransition();

  if (value !== synced) {
    setSynced(value);
    setLocal(value ? String(value) : "");
  }

  function commit() {
    const trimmed = local.trim().replace(",", ".");
    const parsed = trimmed === "" ? 0 : Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) {
      setLocal(value ? String(value) : "");
      return;
    }
    if (parsed === value) return;
    startTransition(async () => {
      await onSave(parsed);
      router.refresh();
    });
  }

  return (
    <input
      inputMode="decimal"
      className={`w-full min-w-14 rounded border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums outline-none hover:border-border focus:border-primary ${
        pending ? "opacity-50" : ""
      }`}
      value={local}
      placeholder="·"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function CopyMonthForm({ months }: { months: string[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(months[0]);
  const [to, setTo] = useState(months[1]);
  const [scope, setScope] = useState<GoalField | "both">("both");
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Copiar metas de</span>
      <select className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Mes de origen">
        {months.map((m, i) => (
          <option key={m} value={m}>
            {MONTH_LABELS[i]}
          </option>
        ))}
      </select>
      <span className="text-muted">a</span>
      <select className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Mes de destino">
        {months.map((m, i) => (
          <option key={m} value={m}>
            {MONTH_LABELS[i]}
          </option>
        ))}
      </select>
      <select className="input !w-auto" value={scope} onChange={(e) => setScope(e.target.value as GoalField | "both")} aria-label="Qué copiar">
        <option value="both">Leads y presupuesto</option>
        <option value="leads">Solo leads</option>
        <option value="budget">Solo presupuesto</option>
      </select>
      <button
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (!confirm("Esto reemplaza las metas del mes de destino. ¿Continuar?")) return;
            setMessage(await copyMonthAction(from, to, scope));
            router.refresh();
          })
        }
      >
        Copiar
      </button>
      {message && <span className={message.ok ? "text-green" : "text-red"}>{message.message}</span>}
    </div>
  );
}

export function GoalsGrid({
  year,
  months,
  careers,
  goals,
  members,
}: {
  year: number;
  months: string[];
  careers: Career[];
  goals: CareerMonthlyGoal[];
  members: PublicUser[];
}) {
  const [field, setField] = useState<GoalField>("leads");
  const [program, setProgram] = useState("");
  const [owner, setOwner] = useState("");
  const [query, setQuery] = useState("");

  const goalMap = useMemo(() => new Map(goals.map((g) => [`${g.career_id}:${g.month}`, g])), [goals]);
  const valueOf = (careerId: number, month: string) => {
    const g = goalMap.get(`${careerId}:${month}`);
    return g ? (field === "leads" ? g.leads_goal : g.budget_goal) : 0;
  };
  const fmt = field === "leads" ? num : money;

  const programs = useMemo(
    () => [...new Set(careers.map((c) => c.program))].sort((a, b) => a.localeCompare(b, "es")),
    [careers]
  );

  const filtered = careers.filter((c) => {
    if (program && c.program !== program) return false;
    if (owner === "none" ? c.owner_id !== null : owner && String(c.owner_id) !== owner) return false;
    if (query && !normalizeText(`${c.code} ${c.name}`).includes(normalizeText(query))) return false;
    return true;
  });

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const monthTotals = months.map((m) => filtered.reduce((sum, c) => sum + valueOf(c.id, m), 0));
  const yearTotal = monthTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Link href={`/metas?anio=${year - 1}`} className="rounded px-2 py-1 text-sm hover:bg-background" aria-label="Año anterior">
              ←
            </Link>
            <span className="px-2 text-sm font-semibold">{year}</span>
            <Link href={`/metas?anio=${year + 1}`} className="rounded px-2 py-1 text-sm hover:bg-background" aria-label="Año siguiente">
              →
            </Link>
          </div>
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {(
              [
                ["leads", "Meta de leads"],
                ["budget", "Presupuesto"],
              ] as [GoalField, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setField(key)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${field === key ? "bg-card shadow-sm" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select className="input !w-auto" value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Programa">
            <option value="">Todos los programas</option>
            {programs.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="input !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
            <option value="">Todos los responsables</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="none">Sin responsable</option>
          </select>
          <input
            className="input !w-auto"
            type="search"
            placeholder="Buscar carrera"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar carrera"
          />
          <span className="text-sm text-muted">{filtered.length} carreras</span>
        </div>
        <CopyMonthForm months={months} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">Carrera</th>
              {months.map((m, i) => (
                <th key={m} className={`px-1 text-right ${m === currentMonth ? "text-primary" : ""}`}>
                  {MONTH_LABELS[i]}
                </th>
              ))}
              <th className="px-3 text-right">Total año</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const rowTotal = months.reduce((sum, m) => sum + valueOf(c.id, m), 0);
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background/60">
                  <td className="sticky left-0 z-10 max-w-72 bg-card px-3 py-1.5">
                    <div className="flex items-baseline gap-2">
                      {c.code && <span className="font-mono text-xs font-semibold text-primary">{c.code}</span>}
                      <span className="truncate font-medium" title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {c.program} · {members.find((m) => m.id === c.owner_id)?.name ?? "Sin responsable"}
                    </p>
                  </td>
                  {months.map((m) => (
                    <td key={m} className={`px-1 ${m === currentMonth ? "bg-primary/5" : ""}`}>
                      <GoalCell
                        key={field}
                        value={valueOf(c.id, m)}
                        onSave={(v) => setMonthlyGoalAction(c.id, m, field, v)}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 text-right font-semibold tabular-nums">
                    {rowTotal ? fmt(rowTotal) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="sticky left-0 z-10 bg-card px-3 py-2">Total</td>
              {monthTotals.map((t, i) => (
                <td key={months[i]} className="whitespace-nowrap px-1 text-right text-xs tabular-nums">
                  {t ? fmt(t) : "—"}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 text-right tabular-nums">{yearTotal ? fmt(yearTotal) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted">
        Haz clic en una celda para escribir la meta del mes y presiona Enter. Las metas son totales
        mensuales; la semana que cruza dos meses toma la parte proporcional de cada uno.
      </p>
    </div>
  );
}
