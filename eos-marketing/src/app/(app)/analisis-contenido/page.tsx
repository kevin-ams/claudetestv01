import { getSession } from "@/lib/auth/session";
import { listCoverages, listOptions, listPieces } from "@/lib/domain/editorial";
import { listTeamMembers } from "@/lib/domain/users";
import {
  breakdown,
  byPerson,
  PERIOD_LABEL,
  resolvePeriod,
  shiftPeriod,
  totals,
  trend,
  trendBuckets,
  type PeriodKind,
} from "@/lib/domain/content-analytics";
import { ContentAnalysisBoard } from "./content-analysis-board";
import { format } from "date-fns";

const KINDS = Object.keys(PERIOD_LABEL) as PeriodKind[];

export default async function AnalisisContenidoPage({ searchParams }: PageProps<"/analisis-contenido">) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const kind = (KINDS as string[]).includes(one(sp.periodo) ?? "") ? (one(sp.periodo) as PeriodKind) : "mes";
  const today = format(new Date(), "yyyy-MM-dd");
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.fecha) ?? "") ? one(sp.fecha)! : today;
  const period = resolvePeriod(kind, ref, one(sp.desde), one(sp.hasta));
  const buckets = trendBuckets(period);
  const from = [period.prev.from, buckets[0]?.from ?? period.from].sort()[0];

  const [pieces, coverages, members, options] = await Promise.all([
    listPieces(session.teamId, from, period.to),
    listCoverages(session.teamId, from, period.to),
    listTeamMembers(session.teamId),
    listOptions(session.teamId),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Análisis de contenido</h1>
        <p className="text-sm text-muted">
          Métricas del Calendario editorial y del Control de coberturas por semana, mes, trimestre, año o un rango. Las
          piezas cuentan en la semana en que se planificaron.
        </p>
      </div>
      <ContentAnalysisBoard
        period={period}
        prevRef={shiftPeriod(period, -1)}
        nextRef={shiftPeriod(period, 1)}
        today={today}
        current={totals(pieces, coverages, period.from, period.to)}
        previous={totals(pieces, coverages, period.prev.from, period.prev.to)}
        trend={trend(pieces, coverages, buckets)}
        trendUnit={buckets.length > 0 && /^\d/.test(buckets[0].label) ? "semana" : "mes"}
        people={byPerson(pieces, coverages, period.from, period.to)}
        pilares={breakdown(pieces, period.from, period.to, (p) => p.pilar)}
        facultades={breakdown(pieces, period.from, period.to, (p) => p.facultad)}
        frentes={breakdown(pieces, period.from, period.to, (p) => p.frente)}
        estados={breakdown(pieces, period.from, period.to, (p) => p.status, true)}
        pilarHints={Object.fromEntries(options.pilar.map((o) => [o.value, o.hint]))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
