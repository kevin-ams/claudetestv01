"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { Button, Card, Chip, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicUser } from "@/lib/domain/types";
import {
  budgetTone,
  CAREER_LEVELS,
  costPerLead,
  leadsTone,
  money,
  normalizeText,
  num,
  pct,
  totalsFor,
  TONE_CHIP,
  type CareerRow,
} from "@/lib/domain/careers-shared";
import {
  archiveCareerAction,
  setBudgetAction,
  setLeadsAction,
  setOwnerAction,
  updateCareerAction,
} from "./actions";
import { GroupTable, SummaryTiles } from "./career-summary";

type View = "detalle" | "responsable" | "programa";

function NumberCell({
  value,
  onSave,
  className = "",
  title,
}: {
  value: number | null;
  onSave: (value: number | null) => Promise<void>;
  className?: string;
  title?: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [pending, startTransition] = useTransition();
  const [synced, setSynced] = useState(value);

  // Si el dato cambia desde el servidor (importación, sync), refleja el nuevo valor.
  if (value !== synced) {
    setSynced(value);
    setLocal(value === null ? "" : String(value));
  }

  function commit() {
    const trimmed = local.trim().replace(",", ".");
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setLocal(value === null ? "" : String(value));
      return;
    }
    if (parsed === value) return;
    startTransition(async () => {
      await onSave(parsed);
      router.refresh();
    });
  }

  return (
    <Input
      inputMode="decimal"
      title={title}
      className={`shadow-none w-20 rounded border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums outline-none hover:border-border focus:border-primary ${
        pending ? "opacity-50" : ""
      } ${className}`}
      value={local}
      placeholder="—"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SourceTag({ source }: { source: string | null }) {
  if (!source || source === "manual") return null;
  const label = source === "activecampaign" ? "AC" : "CSV";
  return (
    <span
      title={source === "activecampaign" ? "Desde ActiveCampaign" : "Desde importación CSV"}
      className="ml-1 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary"
    >
      {label}
    </span>
  );
}

function EditCareerRow({
  row,
  members,
  programs,
  onClose,
}: {
  row: CareerRow;
  members: PublicUser[];
  programs: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <tr className="border-b border-border bg-background">
      <td colSpan={10} className="p-3">
        <form
          action={async (fd) => {
            await updateCareerAction(row.id, fd);
            onClose();
            router.refresh();
          }}
          className="grid gap-2 sm:grid-cols-6"
        >
          <Input fullWidth name="program" list="career-programs" required defaultValue={row.program} placeholder="Programa" />
          <Input fullWidth name="code" defaultValue={row.code} placeholder="Código" />
          <Input fullWidth name="name" required defaultValue={row.name} className="sm:col-span-2" placeholder="Nombre de la carrera" />
          <AppSelect fullWidth name="level" defaultValue={row.level}>
            {CAREER_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </AppSelect>
          <AppSelect fullWidth name="ownerId" defaultValue={row.owner_id ?? "none"}>
            <option value="none">Sin responsable</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </AppSelect>
          <datalist id="career-programs">
            {programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-2 sm:col-span-6">
            <Button variant="primary" size="sm" type="submit">
              Guardar
            </Button>
            <Button variant="outline" size="sm" type="button" onPress={onClose}>
              Cancelar
            </Button>
            <Button variant="danger-soft" size="sm"
              type="button"
              className="ml-auto"
              onPress={async () => {
                if (confirm(`¿Archivar "${row.name}"? Dejará de aparecer en los indicadores.`)) {
                  await archiveCareerAction(row.id);
                  onClose();
                  router.refresh();
                }
              }}
            >
              Archivar carrera
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function CareerBoard({
  rows,
  members,
  week,
}: {
  rows: CareerRow[];
  members: PublicUser[];
  week: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const program = params.get("programa") ?? "";
  const level = params.get("nivel") ?? "";
  const owner = params.get("resp") ?? "";
  const career = params.get("carrera") ?? "";
  const query = params.get("q") ?? "";
  const onlyRed = params.get("rojo") === "1";
  const view = (params.get("vista") as View) || "detalle";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Al cambiar de programa, la carrera elegida puede dejar de aplicar.
    if (key === "programa") next.delete("carrera");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const programs = useMemo(
    () => [...new Set(rows.map((r) => r.program))].sort((a, b) => a.localeCompare(b, "es")),
    [rows]
  );

  const careerOptions = useMemo(
    () =>
      rows
        .filter((r) => !program || r.program === program)
        .map((r) => ({ id: r.id, label: r.code ? `${r.code} · ${r.name}` : r.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [rows, program]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    const hasLeads = rows.some((r) => r.leads !== null);
    return rows.filter((r) => {
      if (program && r.program !== program) return false;
      if (level && r.level !== level) return false;
      if (owner === "none" ? r.owner_id !== null : owner && String(r.owner_id) !== owner) return false;
      if (career && String(r.id) !== career) return false;
      if (q) {
        const hay = normalizeText(`${r.code} ${r.name} ${r.program}`);
        if (!hay.includes(q)) return false;
      }
      if (onlyRed) {
        const red =
          (hasLeads && leadsTone(r.leads ?? 0, r.leads_goal) === "red") ||
          budgetTone(r.budget_spent, r.budget_goal) === "red";
        if (!red) return false;
      }
      return true;
    });
  }, [rows, program, level, owner, career, query, onlyRed]);

  const totals = totalsFor(filtered);
  const anyFilter = program || level || owner || career || query || onlyRed;

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <AppSelect fullWidth value={program} onChange={(e) => setParam("programa", e.target.value)} aria-label="Programa">
          <option value="">Todos los programas</option>
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </AppSelect>
        <AppSelect fullWidth className="lg:col-span-2" value={career} onChange={(e) => setParam("carrera", e.target.value)} aria-label="Carrera">
          <option value="">Todas las carreras</option>
          {careerOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </AppSelect>
        <AppSelect fullWidth value={level} onChange={(e) => setParam("nivel", e.target.value)} aria-label="Nivel">
          <option value="">Todos los niveles</option>
          {CAREER_LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </AppSelect>
        <AppSelect fullWidth value={owner} onChange={(e) => setParam("resp", e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="none">Sin responsable</option>
        </AppSelect>
        <Input fullWidth
          type="search"
          placeholder="Buscar código o nombre"
          defaultValue={query}
          onChange={(e) => setParam("q", e.target.value)}
          aria-label="Buscar carrera"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-2 lg:col-span-6">
          <AppCheckbox checked={onlyRed} onChange={(e) => setParam("rojo", e.target.checked ? "1" : "")} className="flex items-center gap-2">
            Solo a revisar
          </AppCheckbox>
          <span className="text-muted">
            {filtered.length} de {rows.length} carreras
          </span>
          {anyFilter && (
            <Button size="sm" variant="ghost" className="text-primary" onPress={() => router.replace(`${pathname}?semana=${week}`, { scroll: false })}>
              Limpiar filtros
            </Button>
          )}
          <Segmented
            aria-label="Vista"
            className="ml-auto"
            options={[
              { id: "detalle" as View, label: "Detalle" },
              { id: "responsable" as View, label: "Por responsable" },
              { id: "programa" as View, label: "Por programa" },
            ]}
            value={view}
            onChange={(key) => setParam("vista", key === "detalle" ? "" : key)}
          />
        </div>
      </Card>

      <SummaryTiles rows={filtered} />

      {view !== "detalle" ? (
        <Card className="block gap-0 p-4">
          <GroupTable rows={filtered} by={view === "responsable" ? "owner" : "program"} members={members} />
        </Card>
      ) : (
        <Card className="block p-0 gap-0 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Carrera</th>
                <th className="px-2">Responsable</th>
                <th className="px-2 text-right">Leads</th>
                <th className="px-2 text-right">Meta</th>
                <th className="px-2 text-right">%</th>
                <th className="px-2 text-right">Consumo</th>
                <th className="px-2 text-right">Presupuesto</th>
                <th className="px-2 text-right">%</th>
                <th className="px-2 text-right">CPL</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) =>
                editing === r.id ? (
                  <EditCareerRow
                    key={r.id}
                    row={r}
                    members={members}
                    programs={programs}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-3 py-1.5">
                      <div className="flex items-baseline gap-2">
                        {r.code && <span className="font-mono text-xs font-semibold text-primary">{r.code}</span>}
                        <span className="font-medium">{r.name}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {r.program} · {r.level}
                      </p>
                    </td>
                    <td className="px-2">
                      <AppSelect
                        variant="secondary"
                        className="min-w-32"
                        value={r.owner_id ?? "none"}
                        aria-label={`Responsable de ${r.name}`}
                        onChange={(e) =>
                          startTransition(async () => {
                            await setOwnerAction(r.id, e.target.value === "none" ? null : Number(e.target.value));
                            router.refresh();
                          })
                        }
                      >
                        <option value="none">—</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-2 text-right">
                      <span className="inline-flex items-center">
                        <NumberCell value={r.leads} title="Leads recibidos en la semana" onSave={(v) => setLeadsAction(r.id, week, v)} />
                        <SourceTag source={r.leads_source} />
                      </span>
                    </td>
                    <td className="px-2 text-right">
                      <span className="px-1 text-sm font-semibold tabular-nums text-muted" title="Meta de la semana (desde Metas de carrera)">
                        {num(r.leads_goal)}
                      </span>
                    </td>
                    <td className="px-2 text-right">
                      <Chip size="sm" variant="soft" color={TONE_CHIP[leadsTone(r.leads, r.leads_goal)]}>{pct(r.leads, r.leads_goal)}</Chip>
                    </td>
                    <td className="px-2 text-right">
                      <span className="inline-flex items-center">
                        <NumberCell
                          value={r.budget_spent}
                          title="Consumo de la semana"
                          onSave={(v) => setBudgetAction(r.id, week, v)}
                        />
                        <SourceTag source={r.budget_source} />
                      </span>
                    </td>
                    <td className="px-2 text-right">
                      <span className="px-1 text-sm font-semibold tabular-nums text-muted" title="Presupuesto de la semana (desde Metas de carrera)">
                        {num(r.budget_goal)}
                      </span>
                    </td>
                    <td className="px-2 text-right">
                      <Chip size="sm" variant="soft" color={TONE_CHIP[budgetTone(r.budget_spent, r.budget_goal)]}>
                        {pct(r.budget_spent, r.budget_goal)}
                      </Chip>
                    </td>
                    <td className="whitespace-nowrap px-2 text-right text-xs tabular-nums text-muted">{costPerLead(r.budget_spent, r.leads)}</td>
                    <td className="px-2 text-right">
                      <Button size="sm" variant="ghost" className="text-xs text-primary" onPress={() => setEditing(r.id)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                )
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted">
                    Ninguna carrera coincide con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Total ({totals.careers})
                  </td>
                  <td className="px-2 text-right tabular-nums">{totals.hasLeads ? num(totals.leads) : "—"}</td>
                  <td className="px-2 text-right tabular-nums">{num(totals.leadsGoal)}</td>
                  <td className="px-2 text-right">{pct(totals.hasLeads ? totals.leads : null, totals.leadsGoal)}</td>
                  <td className="px-2 text-right tabular-nums">{totals.hasSpent ? money(totals.spent) : "—"}</td>
                  <td className="px-2 text-right tabular-nums">{money(totals.budgetGoal)}</td>
                  <td className="px-2 text-right">{pct(totals.hasSpent ? totals.spent : null, totals.budgetGoal)}</td>
                  <td className="whitespace-nowrap px-2 text-right text-xs tabular-nums">
                    {costPerLead(totals.hasSpent ? totals.spent : null, totals.leads)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}
      <p className="text-xs text-muted">
        Semáforo — Leads: verde ≥100% de la meta, amarillo ≥80%, rojo menor. Presupuesto: verde si
        se consumió entre 90% y 110% del plan, amarillo entre 75–90% o 110–125%, rojo fuera de ese
        rango. La meta y el presupuesto de la semana se calculan desde{" "}
        <a href="/metas" className="text-primary underline">Metas de carrera</a> (proporcional a los
        días de la semana en cada mes). Haz clic en leads o consumo para editarlos; <b>AC</b> = dato de ActiveCampaign,{" "}
        <b>CSV</b> = dato importado.
      </p>
    </div>
  );
}
