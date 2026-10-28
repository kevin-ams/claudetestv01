import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/access";
import { listCareers } from "@/lib/domain/careers";
import { listLinks } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { careerValueCounts, getDashMeta, getDashSettings } from "@/lib/domain/deals";
import { demoDeals } from "@/lib/domain/deals-demo";
import { careerResolver, conversionKeys, guessFieldMap, linkedPipelines } from "@/lib/domain/deals-resolve";
import type { Career } from "@/lib/domain/types";
import { SettingsHeader } from "../settings-header";
import { DealsSettingsForm } from "./settings-form";

/** Datos de ejemplo: valores de "Nombre de la Carrera" por embudo. */
function demoData(careers: Career[]) {
  const demo = demoDeals(careers, Date.now());
  const counts = new Map<string, { pipelineId: string; value: string; count: number }>();
  for (const d of demo.deals) {
    const k = `${d.pipelineId}::${d.careerValue}`;
    const c = counts.get(k) ?? { pipelineId: d.pipelineId, value: d.careerValue, count: 0 };
    c.count++;
    counts.set(k, c);
  }
  return { meta: demo.meta, values: [...counts.values()], careers: demo.careers, links: demo.links };
}

export default async function DealsSettingsPage() {
  const session = await getSession();
  if (!session) return null;
  await requireAdmin("Solo un administrador puede cambiar los ajustes del Dashboard AC.");

  const configured = isActiveCampaignConfigured();
  const [teamCareers, teamLinks, settings] = await Promise.all([listCareers(session.teamId), listLinks(session.teamId), getDashSettings()]);

  let meta;
  let values: { pipelineId: string; value: string; count: number }[];
  let careers: Career[] = teamCareers;
  let links: { career_id: number; pipeline_id: string; career_value: string }[] = teamLinks;
  if (configured) {
    [meta, values] = await Promise.all([getDashMeta(), careerValueCounts()]);
  } else {
    ({ meta, values, careers, links } = demoData(teamCareers));
  }

  // Solo las etapas de los embudos vinculados, agrupadas por nombre.
  const linked = linkedPipelines(links);
  const stageMap = new Map<string, { key: string; name: string; pipelines: number; order: number }>();
  for (const s of meta.stages) {
    if (!linked.has(s.pipelineId)) continue;
    const e = stageMap.get(s.key) ?? { key: s.key, name: s.title, pipelines: 0, order: 0 };
    e.order = (e.order * e.pipelines + s.order) / (e.pipelines + 1);
    e.pipelines++;
    stageMap.set(s.key, e);
  }
  const stages = [...stageMap.values()].sort((a, b) => a.order - b.order);
  const linkedMeta = { ...meta, stages: meta.stages.filter((s) => linked.has(s.pipelineId)) };

  // Tratos de los embudos vinculados cuyo "Nombre de la Carrera" no coincide con ningún vínculo.
  const resolve = careerResolver(careers, links);
  const unmatched = values
    .filter((v) => linked.has(v.pipelineId) && !resolve({ pipelineId: v.pipelineId, careerValue: v.value }).career)
    .sort((a, b) => b.count - a.count);
  const unmatchedTotal = unmatched.reduce((s, v) => s + v.count, 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SettingsHeader title="Dashboard AC" description="Qué cuenta como conversión y de qué campos de ActiveCampaign salen las UTM y la clasificación del lead." />
      {!configured && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          ActiveCampaign no está configurado en este servidor: las opciones salen de los datos de ejemplo.
        </p>
      )}
      {configured && !meta.fetchedAt && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Sincroniza primero en el{" "}
          <Link href="/dashboard-ac" className="underline">
            Dashboard AC
          </Link>{" "}
          para leer las etapas y los campos de ActiveCampaign.
        </p>
      )}
      <p className="text-sm text-muted">
        Embudos, carreras y facultades salen de{" "}
        <Link href="/ajustes/activecampaign" className="text-primary underline">
          Leads desde ActiveCampaign
        </Link>{" "}
        ({linked.size} embudos vinculados).
        {unmatchedTotal > 0 && (
          <>
            {" "}
            {unmatchedTotal} tratos de esos embudos no coinciden con ninguna carrera vinculada y no se cuentan (p. ej.{" "}
            {unmatched
              .slice(0, 3)
              .map((v) => `“${v.value || "sin Nombre de la Carrera"}”`)
              .join(", ")}
            ).
          </>
        )}
      </p>
      <DealsSettingsForm
        settings={settings}
        stages={stages}
        defaultConversion={conversionKeys({ ...settings, conversionStageKeys: null }, linkedMeta)}
        currentConversion={conversionKeys(settings, linkedMeta)}
        dealFields={meta.dealFields}
        contactFields={meta.contactFields}
        detected={guessFieldMap(meta)}
      />
    </div>
  );
}
