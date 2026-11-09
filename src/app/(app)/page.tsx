import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getActiveMeeting, listMeetings } from "@/lib/domain/meetings";
import { countOpenIssues } from "@/lib/domain/issues";
import { countOpenTodos, countOverdueTodos } from "@/lib/domain/todos";
import { listRocks } from "@/lib/domain/rocks";
import { listOwners, listMetrics, listTargets, listEntries } from "@/lib/domain/scorecard";
import { buildScorecardGrid, statusFor } from "@/lib/domain/scorecard-shared";
import { currentQuarter, weekStartISO } from "@/lib/utils/dates";
import {
  ArrowRight,
  CalendarDays,
  ChartColumnBig,
  CircleAlert,
  Clock,
  ListChecks,
  Mountain,
  Star,
  type LucideIcon,
} from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/ui/modules";

type Tone = "dashboard" | "vto" | "accountability" | "rocks" | "scorecard" | "issues" | "todos" | "meeting" | "team" | "green" | "red" | "orange";

function StatCard({
  label,
  value,
  hint,
  href,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href: string;
  tone: Tone;
  icon: LucideIcon;
}) {
  return (
    <Link href={href} className={`tone-${tone} stat-card flex flex-col gap-3 p-5`}>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/85">
          {label}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Icon size={18} strokeWidth={2.3} aria-hidden />
        </span>
      </div>
      <span className="relative z-10 text-4xl font-extrabold tracking-tight">{value}</span>
      {hint && (
        <span className="relative z-10 text-xs font-medium text-white/80">{hint}</span>
      )}
    </Link>
  );
}

function quarterProgress(quarter: number, year: number) {
  const start = new Date(year, (quarter - 1) * 3, 1).getTime();
  const end = new Date(year, quarter * 3, 1).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const weeksLeft = Math.max(0, Math.ceil((end - now) / (7 * 24 * 3600 * 1000)));
  return { pct, weeksLeft };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const { quarter, year } = currentQuarter();
  const week = weekStartISO();

  const [
    activeMeeting,
    recentMeetings,
    openIssues,
    openTodos,
    overdueTodos,
    rocks,
    owners,
    metrics,
    targets,
    entries,
  ] = await Promise.all([
    getActiveMeeting(session.teamId),
    listMeetings(session.teamId),
    countOpenIssues(session.teamId),
    countOpenTodos(session.teamId),
    countOverdueTodos(session.teamId),
    listRocks(session.teamId, quarter, year),
    listOwners(session.teamId),
    listMetrics(session.teamId),
    listTargets(session.teamId),
    listEntries(session.teamId, [week]),
  ]);

  const offTrackRocks = rocks.filter((r) => r.status === "off_track").length;

  const grid = buildScorecardGrid(metrics, owners, targets, entries, [week]);
  const rollupOwner = owners.find((o) => o.is_rollup) ?? owners[0];
  let redMetrics = 0;
  if (rollupOwner) {
    for (const m of metrics) {
      const value = grid.get(`${m.id}:${rollupOwner.id}:${week}`) ?? null;
      const target = targets.find(
        (t) => t.metric_id === m.id && t.owner_id === rollupOwner.id
      )?.target_value ?? null;
      if (statusFor(value, target ?? null, m.direction) === "red") redMetrics++;
    }
  }

  const lastCompleted = recentMeetings.find((m) => m.status === "completed");
  const rating = lastCompleted?.avg_rating != null ? Number(lastCompleted.avg_rating) : null;
  const doneRocks = rocks.filter((r) => r.status === "done").length;
  const onTrackRocks = rocks.filter((r) => r.status === "on_track").length;
  const qp = quarterProgress(quarter, year);
  const pct = (n: number) => (rocks.length ? (n / rocks.length) * 100 : 0);
  const shortcuts: ModuleKey[] = ["vto", "accountability", "scorecard", "meeting"];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="tone-dashboard mx-auto max-w-6xl">
      <div
        className="animate-in relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 md:p-8"
        style={{
          background:
            "radial-gradient(500px 260px at 90% 10%, rgb(244 114 182 / 0.55), transparent 70%), radial-gradient(400px 260px at 10% 100%, rgb(14 165 233 / 0.45), transparent 70%), linear-gradient(120deg, #4338ca, #7c3aed)",
        }}
      >
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/75">{greeting},</p>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {session.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-white/80">Así está tu negocio esta semana.</p>
          </div>
          <div className="w-full max-w-xs rounded-2xl bg-white/15 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/85">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden /> Q{quarter} {year}
              </span>
              <span>{qp.weeksLeft} semanas restantes</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${qp.pct}%`, animation: "grow-x 1s cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "left" }}
              />
            </div>
            <p className="mt-2 text-xs text-white/75">{Math.round(qp.pct)}% del trimestre transcurrido</p>
          </div>
        </div>
      </div>

      {activeMeeting && (
        <Link
          href={`/meeting/${activeMeeting.id}`}
          className="tone-meeting tile lift animate-in mb-6 flex items-center justify-between gap-4 p-4"
        >
          <span className="flex items-center gap-3 font-semibold">
            <span className="pulse-dot" aria-hidden />
            Hay una Reunión Level 10 en curso
          </span>
          <span className="btn btn-primary">
            Continuar <ArrowRight size={16} aria-hidden />
          </span>
        </Link>
      )}

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Issues abiertos"
          value={openIssues}
          hint="Para resolver en IDS"
          href="/issues"
          tone="issues"
          icon={CircleAlert}
        />
        <StatCard
          label="To-Dos pendientes"
          value={openTodos}
          hint={overdueTodos > 0 ? `${overdueTodos} vencidos` : "Ninguno vencido"}
          href="/todos"
          tone="todos"
          icon={ListChecks}
        />
        <StatCard
          label="Rocks off-track"
          value={`${offTrackRocks}/${rocks.length}`}
          hint={offTrackRocks > 0 ? "Requieren atención" : "Todo en camino"}
          href="/rocks"
          tone="rocks"
          icon={Mountain}
        />
        <StatCard
          label="Indicadores en rojo"
          value={redMetrics}
          hint="Esta semana"
          href="/scorecard"
          tone={redMetrics > 0 ? "red" : "scorecard"}
          icon={ChartColumnBig}
        />
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-3">
        <Link href="/rocks" className="tone-rocks tile lift p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Mountain size={20} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Rocks del trimestre</p>
                <p className="text-xs text-muted">
                  {rocks.length} rocks · {doneRocks} completados
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-tone" aria-hidden />
          </div>
          {rocks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aún no hay Rocks para este trimestre.</p>
          ) : (
            <>
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-background">
                <span className="h-full bg-emerald-500" style={{ width: `${pct(doneRocks)}%` }} />
                <span className="h-full bg-sky-400" style={{ width: `${pct(onTrackRocks)}%` }} />
                <span className="h-full bg-rose-500" style={{ width: `${pct(offTrackRocks)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completados {doneRocks}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> On track {onTrackRocks}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Off track {offTrackRocks}
                </span>
              </div>
            </>
          )}
        </Link>

        <Link href="/meeting" className="tone-meeting tile lift flex flex-col p-5">
          <div className="flex items-center gap-3">
            <span className="icon-chip">
              <Star size={20} aria-hidden />
            </span>
            <div>
              <p className="font-semibold">Última reunión</p>
              <p className="text-xs text-muted">Calificación promedio</p>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-tone text-4xl font-extrabold tracking-tight">
              {rating !== null ? rating.toFixed(1) : "–"}
            </span>
            <span className="mb-1 text-sm text-muted">/10</span>
          </div>
          <div className="progress mt-3">
            <span style={{ width: `${(rating ?? 0) * 10}%` }} />
          </div>
          {overdueTodos > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red">
              <Clock size={13} aria-hidden /> {overdueTodos} to-dos vencidos por revisar
            </p>
          )}
        </Link>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-muted">
        Accesos rápidos
      </h2>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((key) => {
          const mod = MODULES[key];
          const Icon = mod.icon;
          return (
            <Link key={key} href={mod.href} className={`tone-${key} tile lift group p-5`}>
              <span className="icon-chip icon-chip-solid transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                <Icon size={20} aria-hidden />
              </span>
              <p className="mt-3 font-semibold">{mod.label}</p>
              <p className="mt-1 text-sm text-muted">{mod.blurb}</p>
              <span className="text-tone mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                Abrir <ArrowRight size={13} aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
