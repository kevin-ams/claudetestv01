"use client";

import { Button, Card } from "@heroui/react";
import { useMemo, useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { FIELD_KEYS, FIELD_LABELS, type AcField, type DashSettings, type FieldKey, type FieldMap, type FieldRef } from "@/lib/domain/deals-shared";
import { saveDealsSettingsAction } from "./actions";

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
}: {
  settings: DashSettings;
  stages: { key: string; name: string; pipelines: number }[];
  defaultConversion: string[];
  currentConversion: string[];
  dealFields: AcField[];
  contactFields: AcField[];
  detected: FieldMap;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [conversion, setConversion] = useState<string[]>(currentConversion);
  const [fieldChoice, setFieldChoice] = useState<Record<FieldKey, string>>(
    () => Object.fromEntries(FIELD_KEYS.map((k) => [k, settings.fieldMap ? refValue(settings.fieldMap[k]) : AUTO])) as Record<FieldKey, string>
  );
  const [staleDays, setStaleDays] = useState(settings.staleDays);
  const [historyMonths, setHistoryMonths] = useState(settings.historyMonths);

  const fieldName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of dealFields) m.set(`deal:${f.id}`, `${f.label} (trato)`);
    for (const f of contactFields) m.set(`contact:${f.id}`, `${f.label} (contacto)`);
    return m;
  }, [dealFields, contactFields]);

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
            ganado. Por defecto: Inscrito y Por inscribir.
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
