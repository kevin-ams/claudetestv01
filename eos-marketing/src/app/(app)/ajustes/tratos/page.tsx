import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/access";
import { listCareers } from "@/lib/domain/careers";
import { listLinks } from "@/lib/domain/ac-sync";
import { listOptions } from "@/lib/domain/editorial";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { careerValueCounts, getDashMeta, getDashSettings } from "@/lib/domain/deals";
import { demoDeals } from "@/lib/domain/deals-demo";
import { careerResolver, conversionKeys, guessFieldMap } from "@/lib/domain/deals-resolve";
import { normKey } from "@/lib/domain/deals-shared";
import type { Career } from "@/lib/domain/types";
import { SettingsHeader } from "../settings-header";
import { DealsSettingsForm, type UnlinkedCareer } from "./settings-form";

/** Datos de ejemplo: valores de "Nombre de la Carrera" por embudo. */
function demoValues(careers: Career[]) {
  const demo = demoDeals(careers, Date.now());
  const counts = new Map<string, { pipelineId: string; value: string; count: number }>();
  for (const d of demo.deals) {
    const k = `${d.pipelineId}::${d.careerValue}`;
    const c = counts.get(k) ?? { pipelineId: d.pipelineId, value: d.careerValue, count: 0 };
    c.count++;
    counts.set(k, c);
  }
  return { meta: demo.meta, values: [...counts.values()] };
}

export default async function DealsSettingsPage() {
  const session = await getSession();
  if (!session) return null;
  await requireAdmin("Solo un administrador puede cambiar los ajustes del Dashboard de tratos.");

  const configured = isActiveCampaignConfigured();
  const [careers, links, settings, options] = await Promise.all([
    listCareers(session.teamId),
    listLinks(session.teamId),
    getDashSettings(),
    listOptions(session.teamId),
  ]);

  let meta;
  let values: { pipelineId: string; value: string; count: number }[];
  if (configured) {
    [meta, values] = await Promise.all([getDashMeta(), careerValueCounts()]);
  } else {
    ({ meta, values } = demoValues(careers));
  }

  // Valores de "Nombre de la Carrera" que no coinciden con una carrera del equipo.
  const resolve = careerResolver(careers, links);
  const unlinkedMap = new Map<string, UnlinkedCareer>();
  for (const v of values) {
    if (!v.value.trim() || resolve({ pipelineId: v.pipelineId, careerValue: v.value }).career) continue;
    const key = normKey(v.value);
    const u = unlinkedMap.get(key) ?? { key, value: v.value.trim(), count: 0 };
    u.count += v.count;
    unlinkedMap.set(key, u);
  }
  const unlinked = [...unlinkedMap.values()].sort((a, b) => b.count - a.count);

  const faculties = [
    ...new Set([
      ...options.facultad.map((o) => o.value),
      ...careers.map((c) => c.program).filter(Boolean),
      ...Object.values(settings.facultyByCareer),
    ]),
  ].sort((a, b) => a.localeCompare(b, "es"));

  // Etapas por nombre (los embudos de cada carrera suelen repetir los mismos nombres).
  const stageMap = new Map<string, { key: string; name: string; pipelines: number; order: number }>();
  for (const s of meta.stages) {
    const e = stageMap.get(s.key) ?? { key: s.key, name: s.title, pipelines: 0, order: 0 };
    e.order = (e.order * e.pipelines + s.order) / (e.pipelines + 1);
    e.pipelines++;
    stageMap.set(s.key, e);
  }
  const stages = [...stageMap.values()].sort((a, b) => a.order - b.order);
  const detected = guessFieldMap(meta);
  const facultyField = detected.faculty
    ? [...meta.dealFields.map((f) => ({ ...f, source: "deal" })), ...meta.contactFields.map((f) => ({ ...f, source: "contact" }))].find(
        (f) => f.id === detected.faculty!.id && f.source === detected.faculty!.source
      )
    : undefined;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Dashboard de tratos"
        description="Qué cuenta como conversión, de qué campos de ActiveCampaign salen las UTM y la clasificación, y la facultad de las carreras que no coinciden con las del equipo."
      />
      {!configured && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          ActiveCampaign no está configurado en este servidor: las opciones salen de los datos de ejemplo.
        </p>
      )}
      {configured && !meta.fetchedAt && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Sincroniza primero en el <Link href="/tratos" className="underline">Dashboard de tratos</Link> para leer las etapas y los campos de ActiveCampaign.
        </p>
      )}
      <p className="text-sm text-muted">
        La carrera de cada trato sale del campo <b>Nombre de la Carrera</b> y de los vínculos de{" "}
        <Link href="/ajustes/activecampaign" className="text-primary underline">
          Leads desde ActiveCampaign
        </Link>
        ; la facultad es la de esa carrera en el catálogo del equipo.{" "}
        {facultyField
          ? `En ActiveCampaign también existe el campo “${facultyField.label}”, que se usa para las carreras sin vínculo.`
          : "En ActiveCampaign no se encontró un campo de facultad, así que las carreras sin vínculo se asignan aquí abajo."}
      </p>
      <DealsSettingsForm
        settings={settings}
        stages={stages}
        defaultConversion={conversionKeys({ ...settings, conversionStageKeys: null }, meta)}
        currentConversion={conversionKeys(settings, meta)}
        dealFields={meta.dealFields}
        contactFields={meta.contactFields}
        detected={detected}
        unlinked={unlinked}
        faculties={faculties}
      />
    </div>
  );
}
