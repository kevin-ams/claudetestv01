"use client";

import { Button, Card, Input, TextArea } from "@heroui/react";
import { useMemo, useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import Link from "next/link";
import { StatusSelect } from "@/components/editorial/status-select";
import { coverageBalance, type Coverage, type EditorialOptions } from "@/lib/domain/editorial-shared";
import { formatShortDate, formatWeekLabel, weekStartISO } from "@/lib/utils/dates";
import { parseISO } from "date-fns";
import { deleteCoverageAction, saveCoverageAction, setCoverageStatusAction } from "./actions";

type Member = { id: number; name: string };
type Balance = { assignee_id: number | null; done: number; overtime: number; replaced: number };

const fmtH = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Math.round(Number(n) * 100) / 100} h`;

export function CoverageBoard({
  coverages,
  balances,
  members,
  options,
  currentUserId,
  editable,
  defaultDate,
}: {
  coverages: Coverage[];
  balances: Balance[];
  members: Member[];
  options: EditorialOptions;
  currentUserId: number;
  editable: boolean;
  defaultDate?: string;
}) {
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () =>
      coverages.filter(
        (c) =>
          (!person || (person === "me" ? c.assignee_id === currentUserId : c.assignee_id === Number(person))) &&
          (!status || c.status === status)
      ),
    [coverages, person, status, currentUserId]
  );

  const name = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin asignar";

  // Resumen del periodo por persona.
  const period = new Map<number | null, { done: number; overtime: number; replaced: number; scheduled: number }>();
  for (const c of filtered) {
    const p = period.get(c.assignee_id) ?? { done: 0, overtime: 0, replaced: 0, scheduled: 0 };
    if (c.status === "Realizada") p.done++;
    if (c.status === "Agendada") p.scheduled++;
    p.overtime += Number(c.overtime_hours);
    p.replaced += Number(c.replaced_hours);
    period.set(c.assignee_id, p);
  }
  const people = [...new Set([...period.keys(), ...balances.map((b) => b.assignee_id)])].filter(
    (id) => !person || (person === "me" ? id === currentUserId : id === Number(person))
  );

  // Coberturas realizadas por semana (lunes).
  const perWeek = new Map<string, number>();
  for (const c of filtered) {
    if (c.status !== "Realizada" || !c.date) continue;
    const w = weekStartISO(parseISO(c.date));
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const weekRows = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxWeek = Math.max(1, ...weekRows.map((w) => w[1]));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((id) => {
          const p = period.get(id) ?? { done: 0, overtime: 0, replaced: 0, scheduled: 0 };
          const b = balances.find((x) => x.assignee_id === id);
          const pending = b ? Math.round((Number(b.overtime) - Number(b.replaced)) * 100) / 100 : 0;
          return (
            <Card key={id ?? "none"} className="p-4">
              <p className="font-semibold">{name(id)}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Realizadas</dt>
                <dd className="text-right tabular-nums">{p.done}</dd>
                <dt className="text-muted">Agendadas</dt>
                <dd className="text-right tabular-nums">{p.scheduled}</dd>
                <dt className="text-muted">Fuera de horario</dt>
                <dd className="text-right tabular-nums">{fmtH(p.overtime)}</dd>
                <dt className="text-muted">Repuestas</dt>
                <dd className="text-right tabular-nums">{fmtH(p.replaced)}</dd>
              </dl>
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${pending > 0 ? "bg-yellow-bg text-yellow" : "bg-green-bg text-green"}`}>
                Saldo por reponer (todo el registro): <strong className="tabular-nums">{fmtH(pending)}</strong>
              </p>
            </Card>
          );
        })}
        <Card className="p-4">
          <p className="font-semibold">Realizadas por semana</p>
          {weekRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin coberturas realizadas en este periodo.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {weekRows.map(([w, n]) => (
                <li key={w} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted">{formatWeekLabel(w)}</span>
                  <span className="h-2 rounded-full bg-primary" style={{ width: `${(n / maxWeek) * 70}%` }} />
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AppSelect aria-label="Asignación" className="w-44" variant="secondary" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Todas las personas</option>
          <option value="me">Solo mías</option>
          {members.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name}
            </option>
          ))}
        </AppSelect>
        <AppSelect aria-label="Estado" className="w-44" variant="secondary" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {options.cob_estado.map((o) => (
            <option key={o.id} value={o.value}>
              {o.value}
            </option>
          ))}
        </AppSelect>
        {editable && (
          <Button variant="primary" className="ml-auto" onPress={() => setAdding((v) => !v)}>
            {adding ? "Cancelar" : "+ Nueva cobertura"}
          </Button>
        )}
      </div>

      {adding && (
        <CoverageForm coverage={null} members={members} options={options} defaultDate={defaultDate} onDone={() => setAdding(false)} />
      )}

      <CoverageTable coverages={filtered} members={members} options={options} editable={editable} />

      <Card className="p-4 text-sm">
        <p className="font-semibold">Paquetes</p>
        <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-muted">
          {options.cob_paquete.map((o) => (
            <li key={o.id}>
              <span className="font-medium text-foreground">{o.value}</span> {o.hint}
            </li>
          ))}
        </ul>
      </Card>

      {editable && (
        <p className="text-xs text-muted">
          Las listas de facultades, tipos, estados y paquetes se editan en{" "}
          <Link href="/ajustes/listas" className="text-primary underline">
            Ajustes › Listas de contenido
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function CoverageTable({
  coverages,
  members,
  options,
  editable,
}: {
  coverages: Coverage[];
  members: Member[];
  options: EditorialOptions;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [, start] = useTransition();
  const statuses = options.cob_estado.map((o) => o.value);
  const hint = (p: string) => options.cob_paquete.find((o) => o.value === p)?.hint ?? "";
  if (coverages.length === 0) return <p className="text-sm text-muted">No hay coberturas en este periodo.</p>;
  const cols = editable ? 10 : 9;
  return (
    <Card className="block gap-0 overflow-x-auto p-0">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="w-28 px-3 py-2">Fecha</th>
            <th className="px-2">Evento / Cobertura</th>
            <th className="w-24 px-2">Horario</th>
            <th className="w-24 px-2">Asignación</th>
            <th className="w-32 px-2">Tipo</th>
            <th className="w-32 px-2">Estado</th>
            <th className="w-32 px-2">Paquete</th>
            <th className="w-28 px-2 text-right">Real / Fuera h.</th>
            <th className="w-24 px-2 text-right">Saldo</th>
            {editable && <th className="w-20 px-2" />}
          </tr>
        </thead>
        <tbody>
          {coverages.map((c) => {
            if (editing === c.id)
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td colSpan={cols} className="p-2">
                    <CoverageForm coverage={c} members={members} options={options} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              );
            const saldo = coverageBalance(c);
            return (
              <tr key={c.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 capitalize text-muted">{c.date ? formatShortDate(c.date) : "—"}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted">{c.facultad}</p>
                  {c.notes && <p className="text-xs italic text-muted">{c.notes}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs">
                  {c.start_time || c.end_time ? `${c.start_time || "?"} – ${c.end_time || "?"}` : "—"}
                </td>
                <td className="px-2 py-2 text-xs">{members.find((m) => m.id === c.assignee_id)?.name ?? "—"}</td>
                <td className="px-2 py-2 text-xs">{c.tipo || "—"}</td>
                <td className="px-2 py-2">
                  <StatusSelect
                    label={`Estado de ${c.title}`}
                    status={c.status}
                    options={statuses}
                    disabled={!editable}
                    onChange={(s) => setCoverageStatusAction(c.id, s)}
                  />
                </td>
                <td className="px-2 py-2 text-xs">
                  {c.paquete || "—"}
                  {(c.est_hours || hint(c.paquete)) && (
                    <span className="block text-muted">{c.est_hours ? `est. ${c.est_hours} h` : hint(c.paquete)}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-xs tabular-nums">
                  {fmtH(c.real_hours)} / {fmtH(c.overtime_hours)}
                  {Number(c.replaced_hours) > 0 && <span className="block text-green">repuestas {fmtH(c.replaced_hours)}</span>}
                </td>
                <td className={`whitespace-nowrap px-2 py-2 text-right text-xs font-semibold tabular-nums ${saldo > 0 ? "text-yellow" : "text-muted"}`}>
                  {saldo > 0 ? fmtH(saldo) : "—"}
                </td>
                {editable && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`Editar ${c.title}`} onPress={() => setEditing(c.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red"
                      aria-label={`Eliminar ${c.title}`}
                      onPress={() => {
                        if (confirm(`¿Eliminar "${c.title}"?`)) start(() => deleteCoverageAction(c.id));
                      }}
                    >
                      ✕
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function CoverageForm({
  coverage,
  members,
  options,
  onDone,
  defaultDate,
}: {
  coverage: Coverage | null;
  members: Member[];
  options: EditorialOptions;
  onDone: () => void;
  defaultDate?: string;
}) {
  const c = coverage;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const withCurrent = (list: string[], cur?: string) => (cur && !list.includes(cur) ? [cur, ...list] : list);
  return (
    <form
      className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveCoverageAction(c?.id ?? null, fd);
          setError(r.ok ? null : r.message);
          if (r.ok) onDone();
        });
      }}
    >
      <Input name="title" aria-label="Evento / Cobertura" placeholder="Evento / Cobertura" defaultValue={c?.title ?? ""} required className="md:col-span-4" autoFocus />
      <AppSelect name="facultad" aria-label="Facultad / Instituto" defaultValue={c?.facultad || "-"} className="md:col-span-2">
        <option value="-">Facultad / instituto…</option>
        {withCurrent(options.facultad.map((o) => o.value), c?.facultad).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AppSelect>
      <label className="flex flex-col text-xs text-muted">
        Fecha
        <Input type="date" name="date" aria-label="Fecha" defaultValue={c?.date ?? defaultDate ?? ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Hora inicio
        <Input type="time" name="start_time" aria-label="Hora inicio" defaultValue={c?.start_time ?? ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Hora fin
        <Input type="time" name="end_time" aria-label="Hora fin" defaultValue={c?.end_time ?? ""} />
      </label>
      <AppSelect name="assignee_id" aria-label="Asignación" defaultValue={c?.assignee_id ? String(c.assignee_id) : "-"}>
        <option value="-">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={String(m.id)}>
            {m.name}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="tipo" aria-label="Tipo" defaultValue={c?.tipo || "-"}>
        <option value="-">Tipo…</option>
        {withCurrent(options.cob_tipo.map((o) => o.value), c?.tipo).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="status" aria-label="Estado" defaultValue={c?.status ?? "Agendada"}>
        {withCurrent(options.cob_estado.map((o) => o.value), c?.status).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="paquete" aria-label="Paquete" defaultValue={c?.paquete || "-"}>
        <option value="-">Paquete…</option>
        {withCurrent(options.cob_paquete.map((o) => o.value), c?.paquete).map((o) => (
          <option key={o} value={o}>
            {o} {options.cob_paquete.find((p) => p.value === o)?.hint}
          </option>
        ))}
      </AppSelect>
      <label className="flex flex-col text-xs text-muted">
        Tiempo estim. (h)
        <Input name="est_hours" aria-label="Tiempo estimado" placeholder="4-5" defaultValue={c?.est_hours ?? ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Tiempo real (h)
        <Input name="real_hours" inputMode="decimal" aria-label="Tiempo real" defaultValue={c?.real_hours ?? ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Horas fuera de horario
        <Input name="overtime_hours" inputMode="decimal" aria-label="Horas fuera de horario" defaultValue={c ? String(c.overtime_hours) : ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Horas repuestas
        <Input name="replaced_hours" inputMode="decimal" aria-label="Horas repuestas" defaultValue={c ? String(c.replaced_hours) : ""} />
      </label>
      <TextArea name="notes" aria-label="Notas" placeholder="Notas" defaultValue={c?.notes ?? ""} className="min-h-10 md:col-span-6" />
      <div className="flex gap-2 md:col-span-6">
        <Button type="submit" variant="primary" size="sm" isDisabled={pending}>
          {c ? "Guardar" : "Agregar"}
        </Button>
        <Button type="button" variant="outline" size="sm" onPress={onDone}>
          Cancelar
        </Button>
        {error && <p className="self-center text-xs text-red">{error}</p>}
      </div>
    </form>
  );
}
