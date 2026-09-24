import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getActiveMeeting, listMeetings, listRecentHeadlines } from "@/lib/domain/meetings";
import { countOpenIssues } from "@/lib/domain/issues";
import { countOpenTodos, countOverdueTodos } from "@/lib/domain/todos";
import { listRocks } from "@/lib/domain/rocks";
import { listOwners, listMetrics, listTargets, listEntries } from "@/lib/domain/scorecard";
import { buildScorecardGrid, statusFor } from "@/lib/domain/scorecard-shared";
import { currentQuarter, weekStartISO } from "@/lib/utils/dates";

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href: string;
  tone?: "red" | "green";
}) {
  return (
    <Link href={href} className="eos-card flex flex-col gap-1 p-5 hover:border-primary">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span
        className={`text-3xl font-bold ${
          tone === "red" ? "text-red" : tone === "green" ? "text-green" : ""
        }`}
      >
        {value}
      </span>
    </Link>
  );
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
  const news = await listRecentHeadlines(session.teamId);

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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hola, {session.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted">Así está tu negocio esta semana.</p>
      </div>

      {activeMeeting && (
        <Link
          href={`/meeting/${activeMeeting.id}`}
          className="eos-card mb-6 flex items-center justify-between border-primary bg-primary/5 p-4"
        >
          <span className="font-medium">Hay una Reunión Level 10 en curso</span>
          <span className="eos-btn eos-btn-primary">Continuar →</span>
        </Link>
      )}

      <section className="eos-card mb-6 p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">📣 Noticias</h2>
          <span className="text-xs text-muted">Compartidas en la Reunión L10</span>
        </div>
        {news.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no hay noticias. Se agregan en el paso &quot;Noticias&quot; de la Reunión L10.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {news.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                <span
                  className={`eos-badge ${n.type === "customer" ? "bg-primary/10 text-primary" : "bg-green-bg text-green"}`}
                >
                  {n.type === "customer" ? "Externa" : "Equipo"}
                </span>
                <span className="min-w-0 flex-1">{n.content}</span>
                <span className="text-xs text-muted">
                  {n.author_name ?? "—"} ·{" "}
                  {new Date(n.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Issues abiertos" value={openIssues} href="/issues" />
        <StatCard
          label="To-Dos vencidos"
          value={overdueTodos}
          href="/todos"
          tone={overdueTodos > 0 ? "red" : undefined}
        />
        <StatCard label="To-Dos pendientes" value={openTodos} href="/todos" />
        <StatCard
          label="Rocks off-track"
          value={`${offTrackRocks}/${rocks.length}`}
          href="/rocks"
          tone={offTrackRocks > 0 ? "red" : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Indicadores en rojo esta semana"
          value={redMetrics}
          href="/scorecard"
          tone={redMetrics > 0 ? "red" : "green"}
        />
        <StatCard
          label="Última calificación de reunión"
          value={lastCompleted?.avg_rating ? `${Number(lastCompleted.avg_rating).toFixed(1)}/10` : "-"}
          href="/meeting"
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/vto" className="eos-card p-5 hover:border-primary">
          <p className="font-semibold">V/TO</p>
          <p className="mt-1 text-sm text-muted">Tu visión y plan de tracción de una página.</p>
        </Link>
        <Link href="/accountability" className="eos-card p-5 hover:border-primary">
          <p className="font-semibold">Organigrama</p>
          <p className="mt-1 text-sm text-muted">Quién es dueño de qué en tu organización.</p>
        </Link>
        <Link href="/meeting" className="eos-card p-5 hover:border-primary">
          <p className="font-semibold">Reunión Level 10</p>
          <p className="mt-1 text-sm text-muted">Corre tu reunión semanal de 90 minutos.</p>
        </Link>
      </div>
    </div>
  );
}
