import { Card } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { canEdit, isTeamAdmin } from "@/lib/auth/access";
import { listCareers } from "@/lib/domain/careers";
import { lastSync, listLinks } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured, listPipelines, type AcPipeline } from "@/lib/integrations/activecampaign";
import { AcSyncButton } from "@/components/ac-sync-button";
import { SettingsHeader } from "../settings-header";
import { LinksEditor } from "./links-editor";
import { BackfillPanel } from "./backfill-panel";
import { formatWeekRange, lastNWeeks, lastClosedWeek } from "@/lib/utils/dates";
import { StatusIcon } from "@/components/status-icon";

const WHEN = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: process.env.EOS_TIMEZONE || "America/Guatemala",
});

export default async function ActiveCampaignPage() {
  const session = await getSession();
  if (!session) return null;
  const configured = isActiveCampaignConfigured();
  const [careers, links, last, editable, admin] = await Promise.all([
    listCareers(session.teamId),
    listLinks(session.teamId),
    lastSync(session.teamId),
    canEdit("indicadores"),
    isTeamAdmin(),
  ]);
  let pipelines: AcPipeline[] = [];
  let error: string | null = null;
  if (configured) {
    try {
      pipelines = await listPipelines();
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudo leer ActiveCampaign.";
    }
  }
  const active = careers.filter((c) => !c.archived);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SettingsHeader
        title="Leads desde ActiveCampaign"
        description="Vincula cada carrera al embudo del director/carrera. El lead calificado de la semana es la cantidad de tratos que entraron a ese embudo (normalmente a “Interesado - Cola de Asesor”) entre el lunes y el domingo, según el historial de cada trato en ActiveCampaign."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <p className={configured && !error ? "text-green" : "text-red"}>
              <StatusIcon status={configured && !error} />
              {configured
                ? error
                  ? error
                  : `Conectado · ${pipelines.length} embudos disponibles`
                : "Sin configurar: faltan ACTIVECAMPAIGN_API_URL y ACTIVECAMPAIGN_API_KEY en Netlify."}
            </p>
            <p>
              <b>Última actualización:</b>{" "}
              {last.at ? (
                <>
                  {WHEN.format(new Date(last.at))} <span className="text-muted">· {last.detail}</span>
                </>
              ) : (
                <span className="text-muted">todavía no se ha sincronizado</span>
              )}
            </p>
            <p className="text-xs text-muted">
              Se actualiza sola cada hora y con el botón cuando quieras; solo escribe la semana en curso (los lunes cierra
              también la semana anterior). La primera vez revisa el historial de las últimas 27 semanas y puede tardar
              varios minutos.
            </p>
          </div>
          {configured && !error && editable && (
            <AcSyncButton label="Sincronizar ahora (semana en curso)" variant="primary" disabled={links.length === 0} />
          )}
        </div>
      </Card>

      {configured && !error && admin && links.length > 0 && (
        <BackfillPanel
          // Las últimas 26 semanas cerradas, de la más reciente a la más antigua.
          weeks={lastNWeeks(26, lastClosedWeek())
            .reverse()
            .map((w) => ({ value: w, label: formatWeekRange(w) }))}
        />
      )}

      {configured && !error && (
        <LinksEditor
          careers={active.map((c) => ({ id: c.id, program: c.program, code: c.code, name: c.name }))}
          links={links}
          pipelines={pipelines}
          editable={editable}
        />
      )}
    </div>
  );
}
