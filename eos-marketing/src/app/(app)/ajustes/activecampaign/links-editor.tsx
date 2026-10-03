"use client";

import { Button, Card, Chip, Input } from "@heroui/react";
import { useMemo, useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import type { AcPipeline } from "@/lib/integrations/activecampaign";
import type { CareerAcLink } from "@/lib/domain/ac-sync";
import { careerValuesAction, deleteLinkAction, saveLinkAction, type LinkResult } from "./actions";

type CareerRow = { id: number; program: string; code: string; name: string };

const norm = (v: string) => v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Zona fija para que el servidor y el navegador muestren lo mismo (evita errores de hidratación).
const WHEN = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala" });

export function LinksEditor({
  careers,
  links,
  pipelines,
  editable,
}: {
  careers: CareerRow[];
  links: CareerAcLink[];
  pipelines: AcPipeline[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "linked" | "unlinked">("all");
  const byCareer = useMemo(() => new Map(links.map((l) => [l.career_id, l])), [links]);

  const rows = careers.filter((c) => {
    const l = byCareer.get(c.id);
    if (view === "linked" && !l) return false;
    if (view === "unlinked" && l) return false;
    const q = norm(query);
    return !q || norm(`${c.program} ${c.code} ${c.name} ${l?.pipeline_name ?? ""} ${l?.career_value ?? ""}`).includes(q);
  });
  const linked = careers.filter((c) => byCareer.has(c.id)).length;

  return (
    <Card className="block gap-0 overflow-x-auto p-0">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <h2 className="font-semibold">
          Carreras <span className="text-sm font-normal text-muted">· {linked} de {careers.length} vinculadas</span>
        </h2>
        <Segmented
          aria-label="Mostrar"
          options={[
            { id: "all" as const, label: "Todas" },
            { id: "linked" as const, label: "Vinculadas" },
            { id: "unlinked" as const, label: "Sin vincular" },
          ]}
          value={view}
          onChange={setView}
        />
        <Input aria-label="Buscar carrera" placeholder="Buscar carrera, código o embudo…" value={query} onChange={(e) => setQuery(e.target.value)} className="ml-auto w-64" />
      </div>
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2">Carrera</th>
            <th className="px-2">Embudo</th>
            <th className="px-2">Carrera en ActiveCampaign</th>
            <th className="px-2 text-right">Semana en curso</th>
            {editable && <th className="w-28 px-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={editable ? 5 : 4} className="px-4 py-6 text-center text-muted">
                {careers.length === 0 ? "No hay carreras. Agrégalas en Indicadores de carrera." : "Ninguna carrera con este filtro."}
              </td>
            </tr>
          )}
          {rows.map((c) => {
            const l = byCareer.get(c.id);
            if (editing === c.id) {
              return (
                <tr key={c.id} className="border-b border-border">
                  <td colSpan={editable ? 5 : 4} className="p-3">
                    <LinkForm career={c} link={l} pipelines={pipelines} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              );
            }
            return (
              <tr key={c.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-2">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.program}
                    {c.code && ` · ${c.code}`}
                  </p>
                </td>
                <td className="px-2 py-2">
                  {l ? (
                    <>
                      <p>{l.pipeline_name}</p>
                    </>
                  ) : (
                    <Chip size="sm" variant="soft">
                      Sin vincular
                    </Chip>
                  )}
                </td>
                <td className="px-2 py-2 text-xs">{l ? l.career_value || <span className="text-muted">Todos los tratos del embudo</span> : "—"}</td>
                <td className="px-2 py-2 text-right">
                  {l?.last_error ? (
                    <span className="text-xs text-red" title={l.last_error}>
                      Error
                    </span>
                  ) : l?.last_count !== null && l?.last_count !== undefined ? (
                    <>
                      <span className="font-semibold tabular-nums">{l.last_count}</span>
                      {l.last_synced_at && <span className="block text-[11px] text-muted">{WHEN.format(new Date(l.last_synced_at))}</span>}
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                {editable && (
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" variant={l ? "ghost" : "outline"} onPress={() => setEditing(c.id)} aria-label={`Vincular ${c.name}`}>
                      {l ? "Editar" : "Vincular"}
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

function LinkForm({
  career,
  link,
  pipelines,
  onDone,
}: {
  career: CareerRow;
  link?: CareerAcLink;
  pipelines: AcPipeline[];
  onDone: () => void;
}) {
  const [pipelineId, setPipelineId] = useState(link?.pipeline_id ?? "-");
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const [value, setValue] = useState(link?.career_value ?? "");
  const [values, setValues] = useState<{ value: string; count: number }[] | null>(null);
  const [loadingValues, startValues] = useTransition();
  const [result, setResult] = useState<LinkResult | null>(null);
  const [pending, start] = useTransition();

  const loadValues = (id: string, autoPick: boolean) =>
    startValues(async () => {
      const v = await careerValuesAction(id);
      setValues(v);
      // Sugerencia: el valor que coincide con el nombre de la carrera.
      if (autoPick) {
        // El nombre de la app puede traer agregados, p. ej. "… (Sede Central)": se compara en ambos sentidos.
        const name = norm(career.name);
        const code = norm(career.code);
        const match =
          v.find((x) => norm(x.value) === name) ??
          v.find((x) => name.includes(norm(x.value)) || norm(x.value).includes(name)) ??
          (code ? v.find((x) => norm(x.value) === code) : undefined) ??
          (v.length === 1 ? v[0] : undefined);
        setValue(match?.value ?? "");
      }
    });

  const choosePipeline = (id: string) => {
    setPipelineId(id);
    const p = pipelines.find((x) => x.id === id);
    setValues(null);
    if (p) loadValues(id, true);
  };

  // Solo de referencia: la etapa de entrada ("Interesado - Cola de Asesor"). El lead cuenta al entrar al embudo.
  const stage = pipeline?.stages.find((s) => /cola/i.test(s.title)) ?? pipeline?.stages[0];
  const listId = `ac-values-${career.id}`;

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pipeline) return setResult({ ok: false, message: "Elige el embudo." });
        start(async () => {
          const r = await saveLinkAction({
            careerId: career.id,
            pipelineId: pipeline.id,
            pipelineName: pipeline.title,
            stageId: stage?.id ?? "",
            stageName: stage?.title ?? "",
            careerValue: value,
          });
          setResult(r);
          if (r.ok) onDone();
        });
      }}
    >
      <p className="font-medium">
        {career.name} <span className="text-xs font-normal text-muted">· {career.program}{career.code && ` · ${career.code}`}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Embudo
          <AppSelect aria-label="Embudo" value={pipelineId} onChange={(e) => choosePipeline(e.target.value)}>
            <option value="-">Elegir embudo…</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </AppSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Carrera en ActiveCampaign (Nombre de la Carrera)
          <Input
            aria-label="Nombre de la carrera en ActiveCampaign"
            placeholder={loadingValues ? "Buscando carreras del embudo…" : "Vacío = todos los tratos del embudo"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list={listId}
            onFocus={() => pipeline && values === null && !loadingValues && loadValues(pipeline.id, false)}
          />
          <datalist id={listId}>
            {(values ?? []).map((v) => (
              <option key={v.value} value={v.value} />
            ))}
          </datalist>
        </label>
      </div>
      {values && values.length > 1 && (
        <p className="text-xs text-muted">
          Este embudo tiene varias carreras ({values.slice(0, 6).map((v) => v.value).join(", ")}
          {values.length > 6 ? "…" : ""}): elige la que corresponde para no contar las demás.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" isPending={pending}>
          Guardar vínculo
        </Button>
        {link && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red"
            isDisabled={pending}
            onPress={() =>
              start(async () => {
                const r = await deleteLinkAction(career.id);
                setResult(r);
                if (r.ok) onDone();
              })
            }
          >
            Quitar vínculo
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onPress={onDone}>
          Cancelar
        </Button>
        {result && !result.ok && <span className="text-xs text-red">{result.message}</span>}
      </div>
    </form>
  );
}
