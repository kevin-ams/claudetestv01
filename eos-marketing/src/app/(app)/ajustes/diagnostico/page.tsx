import { getSession } from "@/lib/auth/session";
import { isTeamAdmin } from "@/lib/auth/access";
import { daysSinceLastBackup, lastBackupEvents } from "@/lib/backup";
import { BackupPanel } from "./backup-panel";
import { runDiagnostics } from "@/lib/domain/diagnostics";
import { SettingsHeader } from "../settings-header";
import { emailConfigured, emailFrom } from "@/lib/email";
import { EmailPanel } from "./email-panel";
import { AcHistoryPanel } from "./ac-history-panel";
import { isActiveCampaignConfigured, listPipelines } from "@/lib/integrations/activecampaign";
import { StatusIcon } from "@/components/status-icon";

export const dynamic = "force-dynamic";

// Se formatea en el servidor, con la zona del equipo, para que coincida al hidratar.
const WHEN = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: process.env.EOS_TIMEZONE || "America/Guatemala",
});

export default async function DiagnosticoPage() {
  const session = await getSession();
  if (!session) return null;
  const [checks, events, admin] = await Promise.all([
    runDiagnostics(session.teamId),
    lastBackupEvents().catch(() => []),
    isTeamAdmin(),
  ]);
  const pipelines = admin && isActiveCampaignConfigured() ? await listPipelines().catch(() => []) : [];
  const failed = checks.filter((c) => !c.ok).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsHeader
        title="Diagnóstico"
        description="Pruebas rápidas de la base de datos, la carpeta de imágenes y el entorno, y respaldos de la información. Si algo no guarda o no carga, empieza aquí."
      />
      <BackupPanel
        events={events.map((e) => ({ ...e, when: WHEN.format(new Date(e.created_at)) }))}
        canEdit={admin} days={daysSinceLastBackup(events)} />
      <EmailPanel configured={emailConfigured()} from={emailFrom()} canTest={admin} />
      {pipelines.length > 0 && <AcHistoryPanel pipelines={pipelines.map((p) => ({ id: p.id, title: p.title }))} />}
      <p
        role="status"
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${failed ? "bg-red-bg text-red" : "bg-green-bg text-green"}`}
      >
        <StatusIcon status={!failed} />
        {failed ? `${failed} prueba(s) con error` : "Todo funciona correctamente"}
      </p>
      <ul className="card card--default block p-0 gap-0 divide-y divide-border">
        {checks.map((c) => (
          <li key={c.name} className="flex items-start gap-3 p-4">
            <span className={`mt-0.5 font-bold ${c.ok ? "text-green" : "text-red"}`} aria-hidden>
              <StatusIcon status={c.ok} size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{c.name}</p>
              <p className={`break-words text-sm ${c.ok ? "text-muted" : "text-red"}`}>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        En tu computadora: si la base falla, detén la app (Ctrl + C) y vuelve a correr <code>npm run dev</code>. Si
        sigue fallando, renombra la carpeta <code>.data</code> (así conservas una copia), abre la app de nuevo y
        restaura tu último respaldo.
      </p>
    </div>
  );
}
