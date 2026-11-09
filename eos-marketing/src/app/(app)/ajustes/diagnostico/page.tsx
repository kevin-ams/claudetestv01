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
import { TIMEZONE } from "@/lib/config/shared";
import { configReport } from "@/lib/config/server";
import { isPlatformOwner } from "@/lib/auth/platform";

export const dynamic = "force-dynamic";

// Se formatea en el servidor, con la zona del equipo, para que coincida al hidratar.
const WHEN = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIMEZONE,
});

export default async function DiagnosticoPage() {
  const session = await getSession();
  if (!session) return null;
  const [checks, events, admin, owner] = await Promise.all([
    runDiagnostics(session.teamId),
    lastBackupEvents().catch(() => []),
    isTeamAdmin(),
    isPlatformOwner(session.userId),
  ]);
  const configItems = admin ? configReport() : [];
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
        canEdit={owner} days={daysSinceLastBackup(events)} />
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
      {configItems.length > 0 && (
        <section className="card card--default flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold">Configuración del servidor</h2>
          <p className="text-xs text-muted">
            Variables de entorno de Netlify: solo se muestra si están, nunca su valor. El inventario completo está en
            docs/seguridad/configuracion.md.
          </p>
          <ul className="divide-y divide-border text-sm">
            {configItems.map((c) => (
              <li key={c.name} className="flex items-start gap-3 py-2">
                <span className={`mt-0.5 ${c.status === "ok" ? "text-green" : c.status === "missing" ? "text-red" : "text-yellow"}`} aria-hidden>
                  <StatusIcon status={c.status === "ok"} size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-xs">
                    {c.name}
                    {c.secret && <span className="ml-2 rounded bg-default px-1.5 py-0.5 font-sans text-[10px] text-muted">secreta</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {c.status === "ok" ? "Configurada" : c.status === "missing" ? "Falta (obligatoria)" : "Sin configurar (opcional)"} · {c.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">
        En tu computadora: si la base falla, detén la app (Ctrl + C) y vuelve a correr <code>npm run dev</code>. Si
        sigue fallando, renombra la carpeta <code>.data</code> (así conservas una copia), abre la app de nuevo y
        restaura tu último respaldo.
      </p>
    </div>
  );
}
