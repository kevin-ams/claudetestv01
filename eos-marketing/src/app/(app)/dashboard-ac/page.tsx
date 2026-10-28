import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { canEdit, isTeamAdmin } from "@/lib/auth/access";
import { listCareers } from "@/lib/domain/careers";
import { listLinks } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { getDashMeta, getDashSettings, listDealsCreated } from "@/lib/domain/deals";
import { getSyncProgress } from "@/lib/domain/deals-sync";
import { demoDeals } from "@/lib/domain/deals-demo";
import { careerResolver, conversionKeys, linkedPipelines, resolveDeals } from "@/lib/domain/deals-resolve";
import type { Career } from "@/lib/domain/types";
import { RANGE_OPTIONS } from "@/lib/domain/deals-shared";
import { DealsDashboard } from "./dashboard";
import { DealsSyncButton } from "./sync-button";

const TZ = process.env.EOS_TIMEZONE || "America/Guatemala";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function today(offsetDays = 0, now: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now + offsetDays * 86_400_000);
}

function resolveRange(range: string, desde: string | undefined, hasta: string | undefined, now: number) {
  const t = today(0, now);
  const [y, m] = t.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (range) {
    case "7d":
      return { from: today(-6, now), to: t };
    case "90d":
      return { from: today(-89, now), to: t };
    case "mes":
      return { from: `${y}-${pad(m)}-01`, to: t };
    case "mes_ant": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(new Date(Date.UTC(y, m - 1, 0)).getUTCDate())}` };
    }
    case "anio":
      return { from: `${y}-01-01`, to: t };
    case "custom": {
      const from = desde && DATE.test(desde) ? desde : today(-29, now);
      const to = hasta && DATE.test(hasta) && hasta >= from ? hasta : t;
      return { from, to };
    }
    default:
      return { from: today(-29, now), to: t };
  }
}

/** https://cuenta.api-us1.com → https://cuenta.activehosted.com/app/deals/ */
function dealUrlBase(): string | null {
  try {
    const account = new URL(process.env.ACTIVECAMPAIGN_API_URL ?? "").hostname.split(".")[0];
    return account ? `https://${account}.activehosted.com/app/deals/` : null;
  } catch {
    return null;
  }
}

// Hora de la solicitud, fuera del componente para que el render sea puro.
const requestTime = () => Date.now();

export default async function TratosPage({ searchParams }: PageProps<"/dashboard-ac">) {
  const session = await getSession();
  if (!session) return null;

  const sp = (await searchParams) as Record<string, string | undefined>;
  const now = requestTime();
  const range = RANGE_OPTIONS.some((o) => o.value === sp.r) ? sp.r! : "30d";
  const { from, to } = resolveRange(range, sp.desde, sp.hasta, now);
  const configured = isActiveCampaignConfigured();

  const [careers, links, settings, editable, admin] = await Promise.all([
    listCareers(session.teamId),
    listLinks(session.teamId),
    getDashSettings(),
    canEdit("dashboard_ac"),
    isTeamAdmin(),
  ]);

  let meta;
  let records;
  let progress = null;
  let baseCareers: Career[] = careers;
  let baseLinks: { career_id: number; pipeline_id: string; career_value: string }[] = links;
  if (configured) {
    [meta, records, progress] = await Promise.all([getDashMeta(), listDealsCreated(from, to), getSyncProgress()]);
  } else {
    ({ meta, deals: records, careers: baseCareers, links: baseLinks } = demoDeals(careers, now));
  }

  // Embudos, carreras y facultades salen de Ajustes › Leads desde ActiveCampaign.
  const linked = linkedPipelines(baseLinks);
  meta = { ...meta, pipelines: meta.pipelines.filter((p) => linked.has(p.id)), stages: meta.stages.filter((s) => linked.has(s.pipelineId)) };
  const deals = resolveDeals(records, {
    meta,
    settings,
    resolveCareer: careerResolver(baseCareers, baseLinks),
    timeZone: TZ,
    now,
  }).filter((d) => d.createdDay >= from && d.createdDay <= to);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 print:max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard AC</h1>
          <p className="text-sm text-muted">
            Tratos de ActiveCampaign por carrera y facultad, y cómo se están gestionando. Periodo por fecha de creación del
            trato. Solo administradores.
          </p>
        </div>
        <div className="flex items-start gap-2">
          {admin && (
            <Link href="/ajustes/dashboard-ac" className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-default">
              Ajustes del dashboard
            </Link>
          )}
          {progress && <DealsSyncButton initial={progress} canSync={editable} />}
        </div>
      </div>

      {!configured && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          <b>Datos de ejemplo.</b> ActiveCampaign no está configurado en este servidor (faltan ACTIVECAMPAIGN_API_URL y
          ACTIVECAMPAIGN_API_KEY), así que se muestran tratos inventados con las carreras reales del equipo.
        </p>
      )}
      {baseLinks.length === 0 && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          No hay carreras vinculadas a embudos. Vincúlalas en{" "}
          <Link href="/ajustes/activecampaign" className="underline">
            Ajustes › Leads desde ActiveCampaign
          </Link>
          : el dashboard usa esos mismos embudos, carreras y facultades.
        </p>
      )}
      {configured && baseLinks.length > 0 && progress?.totalDeals === 0 && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Todavía no hay tratos guardados. Pulsa <b>Sincronizar</b>: la primera vez descarga los tratos de los últimos{" "}
          {settings.historyMonths} meses y lee las notas y el historial de cada uno, así que puede tardar varios minutos (si
          se interrumpe, retoma donde quedó). Después solo trae lo nuevo o modificado, cada vez que pulses el botón.
        </p>
      )}
      <DealsDashboard
        deals={deals}
        pipelines={meta.pipelines}
        stages={meta.stages}
        conversionKeys={conversionKeys(settings, meta)}
        staleDays={settings.staleDays}
        from={from}
        to={to}
        range={range}
        dealUrl={configured ? dealUrlBase() : null}
        timeZone={TZ}
      />
    </div>
  );
}
