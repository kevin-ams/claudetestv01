import { Card } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listCareers } from "@/lib/domain/careers";
import { lastSync, listLinks } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured, listPipelines, type AcPipeline } from "@/lib/integrations/activecampaign";
import { AcSyncButton } from "@/components/ac-sync-button";
import { SettingsHeader } from "../settings-header";
import { LinksEditor } from "./links-editor";

const WHEN = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: process.env.EOS_TIMEZONE || "America/Guatemala",
});

export default async function ActiveCampaignPage() {
  const session = await getSession();
  if (!session) return null;
  const configured = isActiveCampaignConfigured();
  const [careers, links, last, editable] = await Promise.all([
    listCareers(session.teamId),
    listLinks(session.teamId),
    lastSync(session.teamId),
    canEdit("indicadores"),
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
        description="Vincula cada carrera a un embudo y una etapa de tratos. El lead de la semana es la cantidad de tratos que hay en esa etapa al sincronizar, y reemplaza el dato de esa semana (las semanas anteriores no cambian)."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <p className={configured && !error ? "text-green" : "text-red"}>
              {configured
                ? error
                  ? `✕ ${error}`
                  : `✓ Conectado · ${pipelines.length} embudos disponibles`
                : "✕ Sin configurar: faltan ACTIVECAMPAIGN_API_URL y ACTIVECAMPAIGN_API_KEY en Netlify."}
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
              Los leads se guardan solo en la semana en curso: se actualiza sola cada lunes a las 6:00 a. m. y con el
              botón cuando quieras. Las semanas anteriores no cambian.
            </p>
          </div>
          {configured && !error && editable && (
            <AcSyncButton label="↻ Sincronizar ahora (semana en curso)" variant="primary" disabled={links.length === 0} />
          )}
        </div>
      </Card>

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
