import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { guessFieldMap } from "@/lib/activecampaign/analytics";
import { FIELD_KEYS, FIELD_LABELS, type FieldRef } from "@/lib/activecampaign/types";
import { getAcMeta, getDashboardSettings, getFieldMap } from "@/lib/domain/deals";
import { saveConfigAction } from "../actions";

const refValue = (ref: FieldRef) => (ref ? `${ref.source}:${ref.id}` : "");

export default async function TratosConfigPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") redirect("/tratos");

  const [meta, stored, settings] = await Promise.all([getAcMeta(), getFieldMap(), getDashboardSettings()]);
  const map = stored ?? guessFieldMap(meta);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/tratos" className="text-sm text-muted hover:text-foreground">
          ← Tratos
        </Link>
        <h1 className="text-2xl font-bold">Configurar dashboard de tratos</h1>
        <p className="text-sm text-muted">
          Indica en qué campo de ActiveCampaign está cada dato. Puede ser un campo personalizado del trato o
          del contacto. Los cambios se aplican de inmediato, sin volver a sincronizar.
        </p>
      </div>

      {!meta.fetchedAt ? (
        <p className="card p-5 text-sm">Sincroniza primero para leer los campos disponibles en ActiveCampaign.</p>
      ) : (
        <form action={saveConfigAction} className="card flex flex-col gap-4 p-5">
          {FIELD_KEYS.map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm font-medium">
              {FIELD_LABELS[key]}
              <select name={key} defaultValue={refValue(map[key])} className="input font-normal">
                <option value="">— Sin asignar —</option>
                <optgroup label="Campos del trato">
                  {meta.dealFields.map((f) => (
                    <option key={f.id} value={`deal:${f.id}`}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Campos del contacto">
                  {meta.contactFields.map((f) => (
                    <option key={f.id} value={`contact:${f.id}`}>
                      {f.label}
                      {f.key ? ` (%${f.key}%)` : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Días en la misma etapa para considerar un trato “estancado”
            <input
              type="number"
              name="staleDays"
              min={1}
              max={365}
              defaultValue={settings.staleDays}
              className="input !w-32 font-normal"
            />
          </label>
          <div>
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
