import { ArrowRight, Megaphone } from "@gravity-ui/icons";
import { Chip } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { firstAllowedPath, getAccess } from "@/lib/auth/access";
import { getActiveMeeting, listDashboardNews, listMeetings } from "@/lib/domain/meetings";
import { DismissNewsButton } from "./dismiss-news-button";
import { countOpenIssues } from "@/lib/domain/issues";
import { countOpenTodos, countOverdueTodos } from "@/lib/domain/todos";
import { listRocks } from "@/lib/domain/rocks";
import { listOwners, listMetrics, listTargets, listEntries } from "@/lib/domain/scorecard";
import { buildScorecardGrid, statusFor } from "@/lib/domain/scorecard-shared";
import { currentQuarter, weekStartISO } from "@/lib/utils/dates";
import { quoteOfTheDay } from "@/lib/domain/quotes";
import { greetingFor } from "@/lib/domain/greeting";

function StatCard({
  label,
  value,
  total,
  hint,
  href,
  alert,
}: {
  label: string;
  value: string | number;
  total?: string | number;
  hint: string;
  href: string;
  alert?: string | null;
}) {
  return (
    <Link prefetch={false} href={href} className="card card--default lift gap-0 p-5">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        {label}
        {alert && (
          <Chip size="sm" variant="soft" color="danger" className="shrink-0">
            {alert}
          </Chip>
        )}
      </span>
      <span className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
        {value}
        {total !== undefined && <span className="text-lg font-medium text-muted">/{total}</span>}
      </span>
      <span className="mt-2 text-xs text-muted">{hint}</span>
    </Link>
  );
}

/** Semanas que faltan para cerrar el trimestre. */
function weeksLeftInQuarter(quarter: number, year: number) {
  const end = new Date(year, quarter * 3, 1).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / (7 * 24 * 3600 * 1000)));
}

export default async function DashboardPage() {
  const access = await getAccess();
  if (access && access.level("dashboard") === "none") redirect(firstAllowedPath(access));
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
  const [news, quote] = await Promise.all([listDashboardNews(session.teamId, session.userId), quoteOfTheDay(session.teamId)]);
  const greeting = greetingFor(session.name.split(" ")[0]);

  const offTrackRocks = rocks.filter((r) => r.status === "off_track").length;

  const grid = buildScorecardGrid(metrics, owners, targets, entries, [week]);
  const rollupOwner = owners.find((o) => o.is_rollup) ?? owners[0];
  let redMetrics = 0;
  let greenMetrics = 0;
  if (rollupOwner) {
    for (const m of metrics) {
      const value = grid.get(`${m.id}:${rollupOwner.id}:${week}`) ?? null;
      const target = targets.find(
        (t) => t.metric_id === m.id && t.owner_id === rollupOwner.id
      )?.target_value ?? null;
      const status = statusFor(value, target ?? null, m.direction);
      if (status === "red") redMetrics++;
      if (status === "green") greenMetrics++;
    }
  }
  const measuredMetrics = redMetrics + greenMetrics;
  const doneRocks = rocks.filter((r) => r.status === "done").length;
  const onTrackRocks = rocks.filter((r) => r.status === "on_track").length;
  const weeksLeft = weeksLeftInQuarter(quarter, year);

  const lastCompleted = recentMeetings.find((m) => m.status === "completed");
  const rating = lastCompleted?.avg_rating != null ? Number(lastCompleted.avg_rating) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted">{greeting.salute}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting.phrase}</h1>
        <p className="mt-1 text-sm text-muted">
          Así está tu semana · Q{quarter} {year} ·{" "}
          {weeksLeft === 1 ? "1 semana restante" : `${weeksLeft} semanas restantes`}
        </p>
      </div>

      {activeMeeting && (
        <Link
          prefetch={false}
          href={`/meeting/${activeMeeting.id}`}
          className="glass mb-6 flex items-center justify-between gap-3 rounded-2xl border-l-[3px] border-l-primary py-3 pl-4 pr-3"
        >
          <span className="flex items-center gap-3 font-medium">
            <span className="pulse-dot" aria-hidden />
            Hay una Reunión Level 10 en curso
          </span>
          <span className={buttonVariants({ variant: "primary" })}>
            Continuar <ArrowRight aria-hidden />
          </span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <Link prefetch={false} href="/rocks" className="surface-hero lift flex flex-col rounded-3xl p-5">
          <span className="flex items-center justify-between gap-2 text-xs font-medium opacity-80">
            Rocks del trimestre
            <span className="surface-hero-chip rounded-full px-2 py-0.5 text-[11px] font-semibold">Q{quarter}</span>
          </span>
          {rocks.length === 0 ? (
            <>
              <span className="mt-4 text-2xl font-semibold">Sin Rocks</span>
              <span className="mt-2 text-xs opacity-80">Define las prioridades de este trimestre.</span>
            </>
          ) : (
            <>
              <span className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                {rocks.length - offTrackRocks}
                <span className="text-lg font-medium opacity-75">/{rocks.length} en camino</span>
              </span>
              <span className="mt-3 flex h-1.5 gap-1" aria-hidden>
                {doneRocks > 0 && <span className="rounded-full bg-current" style={{ flex: doneRocks }} />}
                {onTrackRocks > 0 && <span className="rounded-full bg-current opacity-50" style={{ flex: onTrackRocks }} />}
                {offTrackRocks > 0 && <span className="rounded-full bg-[#ff9b9b]" style={{ flex: offTrackRocks }} />}
              </span>
              <span className="mt-2 text-xs opacity-80">
                {doneRocks} completados · {onTrackRocks} on track · {offTrackRocks} off track
              </span>
            </>
          )}
        </Link>
        <StatCard label="Issues abiertos" value={openIssues} hint="Para resolver en IDS" href="/issues" />
        <StatCard
          label="To-Dos pendientes"
          value={openTodos}
          hint="Compromisos de 7 días"
          href="/todos"
          alert={overdueTodos > 0 ? `${overdueTodos} vencido${overdueTodos === 1 ? "" : "s"}` : null}
        />
        <StatCard
          label="Scorecard"
          value={measuredMetrics > 0 ? greenMetrics : "–"}
          total={measuredMetrics > 0 ? measuredMetrics : undefined}
          hint={measuredMetrics > 0 ? "Indicadores en meta esta semana" : "Sin datos capturados esta semana"}
          href="/scorecard"
          alert={redMetrics > 0 ? `${redMetrics} en rojo` : null}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card card--default block gap-0 p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Megaphone className="text-primary" aria-hidden /> Noticias
            </h2>
            <span className="text-xs text-muted">De la Reunión L10 · últimos 7 días</span>
          </div>
          {news.length === 0 ? (
            <p className="text-sm text-muted">
              No hay noticias de esta semana. Se agregan en el paso &quot;Noticias&quot; de la Reunión L10.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {news.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <Chip size="sm" variant="soft" color={n.type === "customer" ? "accent" : "success"}>
                    {n.type === "customer" ? "Externa" : "Equipo"}
                  </Chip>
                  <span className="min-w-0 flex-1">{n.content}</span>
                  <span className="text-xs text-muted">
                    {n.author_name ?? "—"} ·{" "}
                    {new Date(n.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "short" })}
                  </span>
                  <DismissNewsButton id={n.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link prefetch={false} href="/meeting" className="card card--default lift gap-0 p-5">
          <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
            Última Reunión L10
            {rating !== null && (
              <Chip size="sm" variant="soft" color={rating >= 8 ? "success" : rating >= 6 ? "warning" : "danger"}>
                {rating >= 8 ? "Buena" : rating >= 6 ? "Regular" : "Por mejorar"}
              </Chip>
            )}
          </span>
          <span className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {rating !== null ? rating.toFixed(1) : "–"}
            <span className="text-lg font-medium text-muted">/10</span>
          </span>
          <span className="mt-4 flex gap-1" role="img" aria-label={`Calificación ${rating?.toFixed(1) ?? "sin datos"} de 10`}>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${rating !== null && i < Math.round(rating) ? "bg-primary" : "bg-foreground/10"}`}
              />
            ))}
          </span>
          <span className="mt-3 text-xs text-muted">
            {lastCompleted
              ? new Date(lastCompleted.ended_at ?? lastCompleted.created_at).toLocaleDateString("es-GT", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })
              : "Aún no hay reuniones completadas"}
          </span>
        </Link>
      </div>

      {quote && (
        <figure className="mx-auto mt-12 max-w-3xl px-2 pb-4 text-center">
          <span aria-hidden className="block font-serif text-6xl leading-none text-primary/30">
            &ldquo;
          </span>
          <blockquote className="-mt-4 text-xl font-medium leading-relaxed text-balance sm:text-2xl">
            {quote.text}
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted">— {quote.author || "Anónimo"}</figcaption>
        </figure>
      )}
    </div>
  );
}
