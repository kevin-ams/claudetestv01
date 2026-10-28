"use client";

import { Button, Card } from "@heroui/react";
import { useMemo, useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { StatusIcon } from "@/components/status-icon";
import { FIELD_KEYS, FIELD_LABELS, fmtNum, type AcField, type DashSettings, type FieldKey, type FieldMap, type FieldRef } from "@/lib/domain/deals-shared";
import { saveDealsSettingsAction } from "./actions";

export type UnlinkedCareer = { key: string; value: string; count: number };

const AUTO = "auto";
const refValue = (ref: FieldRef) => (ref ? `${ref.source}:${ref.id}` : "");
function parseRef(v: string): FieldRef {
  const [source, id] = v.split(":");
  return (source === "deal" || source === "contact") && id ? { source, id } : null;
}

export function DealsSettingsForm({
  settings,
  stages,
  defaultConversion,
  currentConversion,
  dealFields,
  contactFields,
  detected,
  unlinked,
  faculties,
}: {
  settings: DashSettings;
  stages: { key: string; name: string; pipelines: number }[];
  defaultConversion: string[];
  currentConversion: string[];
  dealFields: AcField[];
  contactFields: AcField[];
  detected: FieldMap;
  unlinked: UnlinkedCareer[];
  faculties: string[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [conversion, setConversion] = useState<string[]>(currentConversion);
  const [fieldChoice, setFieldChoice] = useState<Record<FieldKey, string>>(
    () => Object.fromEntries(FIELD_KEYS.map((k) => [k, settings.fieldMap ? refValue(settings.fieldMap[k]) : AUTO])) as Record<FieldKey, string>
  );
  const [facultyBy, setFacultyBy] = useState<Record<string, string>>(settings.facultyByCareer);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkFaculty, setBulkFaculty] = useState("");
  const [newFaculty, setNewFaculty] = useState("");
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [staleDays, setStaleDays] = useState(settings.staleDays);
  const [historyMonths, setHistoryMonths] = useState(settings.historyMonths);

  const fieldName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of dealFields) m.set(`deal:${f.id}`, `${f.label} (trato)`);
    for (const f of contactFields) m.set(`contact:${f.id}`, `${f.label} (contacto)`);
    return m;
  }, [dealFields, contactFields]);

  const facultyOptions = useMemo(
    () => [...new Set([...faculties, ...Object.values(facultyBy), ...(newFaculty.trim() ? [newFaculty.trim()] : [])])].sort((a, b) => a.localeCompare(b, "es")),
    [faculties, facultyBy, newFaculty]
  );
  const needle = query.trim().toLowerCase();
  const visible = unlinked.filter((u) => (!needle || u.value.toLowerCase().includes(needle)) && (!onlyMissing || !facultyBy[u.key]));
  const allVisiblePicked = visible.length > 0 && visible.every((u) => picked.includes(u.key));

  function assign(keys: string[], faculty: string) {
    setFacultyBy((cur) => {
      const next = { ...cur };
      for (const k of keys) {
        if (faculty) next[k] = faculty;
        else delete next[k];
      }
      return next;
    });
  }

  function save() {
    setResult(null);
    const usesAuto = FIELD_KEYS.every((k) => fieldChoice[k] === AUTO);
    const fieldMap = usesAuto
      ? null
      : (Object.fromEntries(FIELD_KEYS.map((k) => [k, fieldChoice[k] === AUTO ? detected[k] : parseRef(fieldChoice[k])])) as FieldMap);
    const sameAsDefault = conversion.length === defaultConversion.length && conversion.every((k) => defaultConversion.includes(k));
    start(async () => {
      try {
        setResult(
          await saveDealsSettingsAction({
            staleDays,
            historyMonths,
            conversionStageKeys: sameAsDefault ? null : conversion,
            fieldMap,
            facultyByCareer: facultyBy,
          })
        );
      } catch (e) {
        setResult({ ok: false, message: e instanceof Error ? e.message : "No se pudo guardar." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">Conversión</h2>
          <p className="text-sm text-muted">
            Un trato cuenta como convertido si está en una de estas etapas (o más adelante en su embudo) o si se marcó como
            ganado. Por defecto se eligen las etapas que dicen “inscri” (Inscrito, Por inscribir).
          </p>
        </div>
        {stages.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay etapas: sincroniza primero.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {stages.map((s) => (
              <AppCheckbox
                key={s.key}
                checked={conversion.includes(s.key)}
                onChange={(e) => setConversion((c) => (e.target.checked ? [...c, s.key] : c.filter((k) => k !== s.key)))}
              >
                <span className="text-sm">
                  {s.name} <span className="text-xs text-muted">({s.pipelines} embudo{s.pipelines === 1 ? "" : "s"})</span>
                </span>
              </AppCheckbox>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">Campos de ActiveCampaign</h2>
          <p className="text-sm text-muted">
            De qué campo sale cada dato. “Automático” busca el campo por su nombre; puede ser un campo del trato o del contacto.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELD_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm font-medium">
              {FIELD_LABELS[k]}
              <AppSelect value={fieldChoice[k]} onChange={(e) => setFieldChoice((c) => ({ ...c, [k]: e.target.value }))} aria-label={FIELD_LABELS[k]}>
                <option value={AUTO}>
                  {`Automático: ${detected[k] ? (fieldName.get(refValue(detected[k])) ?? "encontrado") : "no se encontró"}`}
                </option>
                <option value="">Ninguno</option>
                {dealFields.map((f) => (
                  <option key={`d${f.id}`} value={`deal:${f.id}`}>{`${f.label} (trato)`}</option>
                ))}
                {contactFields.map((f) => (
                  <option key={`c${f.id}`} value={`contact:${f.id}`}>{`${f.label} (contacto)`}</option>
                ))}
              </AppSelect>
            </label>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">Facultad de carreras sin vínculo</h2>
          <p className="text-sm text-muted">
            Estos valores de “Nombre de la Carrera” no coinciden con ninguna carrera del equipo, así que no se sabe su facultad.
            Elige varias y asígnalas juntas, o una por una. Para vincularlas a una carrera del catálogo, usa Leads desde
            ActiveCampaign.
          </p>
        </div>
        {unlinked.length === 0 ? (
          <p className="text-sm text-green">
            <StatusIcon status /> Todas las carreras de los tratos coinciden con una carrera del equipo.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar carrera…"
                className="h-9 w-56 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <AppCheckbox checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)}>
                <span className="text-sm">Solo sin facultad</span>
              </AppCheckbox>
            </div>
            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-default p-3">
              <span className="text-sm">
                <b>{picked.length}</b> elegidas →
              </span>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Facultad
                <AppSelect value={bulkFaculty} onChange={(e) => setBulkFaculty(e.target.value)} aria-label="Facultad para las elegidas" placeholder="Elegir facultad…">
                  {facultyOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </AppSelect>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                o una nueva
                <input
                  value={newFaculty}
                  onChange={(e) => setNewFaculty(e.target.value)}
                  placeholder="Nombre de la facultad"
                  className="h-9 w-48 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={!picked.length || !(newFaculty.trim() || bulkFaculty)}
                onPress={() => {
                  assign(picked, newFaculty.trim() || bulkFaculty);
                  setPicked([]);
                  setNewFaculty("");
                }}
              >
                Asignar a las elegidas
              </Button>
              <Button size="sm" variant="ghost" isDisabled={!picked.length} onPress={() => (assign(picked, ""), setPicked([]))}>
                Quitar facultad
              </Button>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="w-8 py-2">
                      <AppCheckbox
                        aria-label="Elegir todas las visibles"
                        checked={allVisiblePicked}
                        onChange={(e) =>
                          setPicked((p) => (e.target.checked ? [...new Set([...p, ...visible.map((u) => u.key)])] : p.filter((k) => !visible.some((u) => u.key === k))))
                        }
                      />
                    </th>
                    <th className="py-2 pr-3 font-medium">Nombre de la Carrera (ActiveCampaign)</th>
                    <th className="py-2 pr-3 text-right font-medium">Tratos</th>
                    <th className="py-2 font-medium">Facultad</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.key} className="border-b border-border last:border-0">
                      <td className="py-1.5">
                        <AppCheckbox
                          aria-label={`Elegir ${u.value}`}
                          checked={picked.includes(u.key)}
                          onChange={(e) => setPicked((p) => (e.target.checked ? [...p, u.key] : p.filter((k) => k !== u.key)))}
                        />
                      </td>
                      <td className="py-1.5 pr-3">{u.value}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(u.count)}</td>
                      <td className="py-1.5">
                        <AppSelect value={facultyBy[u.key] ?? ""} onChange={(e) => assign([u.key], e.target.value)} aria-label={`Facultad de ${u.value}`}>
                          <option value="">— Sin facultad —</option>
                          {facultyOptions.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </AppSelect>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Días en la misma etapa para considerar un trato “estancado”
          <input
            type="number"
            min={1}
            max={365}
            value={staleDays}
            onChange={(e) => setStaleDays(Number(e.target.value))}
            className="h-9 w-28 rounded-xl border border-border bg-card px-3 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Primera sincronización: tratos creados en los últimos (meses)
          <input
            type="number"
            min={1}
            max={36}
            value={historyMonths}
            onChange={(e) => setHistoryMonths(Number(e.target.value))}
            className="h-9 w-28 rounded-xl border border-border bg-card px-3 text-sm font-normal"
          />
        </label>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="primary" isPending={pending} onPress={save}>
          Guardar
        </Button>
        {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
      </div>
    </div>
  );
}
