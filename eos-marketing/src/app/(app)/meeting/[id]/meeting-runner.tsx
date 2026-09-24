"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Meeting,
  MeetingHeadline,
  Rock,
  RockMilestone,
  PublicUser,
  Issue,
  Todo,
  ScorecardOwner,
  ScorecardMetric,
  ScorecardTarget,
} from "@/lib/domain/types";
import type { SessionPayload } from "@/lib/auth/token";
import { L10_AGENDA, segmentIndex, nextSegment } from "@/lib/domain/meeting-shared";
import { ScorecardTable } from "../../scorecard/scorecard-table";
import { RockCard } from "../../rocks/rock-card";
import { IssueList } from "../../issues/issue-list";
import { AddIssueForm } from "../../issues/add-issue-form";
import { TodoList } from "../../todos/todo-list";
import { CareerSummary } from "../../indicadores/career-summary";
import { careerLabel, num, type CareerRow } from "@/lib/domain/careers-shared";
import { QuickCreateBar, QuickCreateModal, type QuickDraft } from "./quick-create";
import {
  advanceSegmentAction,
  addHeadlineAction,
  rateMeetingAction,
  completeMeetingAction,
} from "../actions";

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return 0;
  return Math.floor((now - new Date(since).getTime()) / 1000);
}

function formatClock(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${sign}${m}:${String(sec).padStart(2, "0")}`;
}

function HeadlinesPanel({
  meetingId,
  headlines,
  onRaiseIssue,
}: {
  meetingId: number;
  headlines: MeetingHeadline[];
  onRaiseIssue: (headline: MeetingHeadline) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Noticias externas</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "customer").map((h) => (
            <li key={h.id} className="eos-card flex items-start justify-between gap-2 p-2">
              <span>{h.content}</span>
              <button
                type="button"
                className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-red hover:bg-red-bg"
                onClick={() => onRaiseIssue(h)}
              >
                → Issue
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          action={async () => {
            await addHeadlineAction(meetingId, "customer", customer);
            setCustomer("");
          }}
        >
          <input
            className="eos-input"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Nueva noticia externa (estudiantes, mercado, universidad)"
          />
          <button type="submit" className="eos-btn eos-btn-secondary">
            +
          </button>
        </form>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Noticias del equipo</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "employee").map((h) => (
            <li key={h.id} className="eos-card flex items-start justify-between gap-2 p-2">
              <span>{h.content}</span>
              <button
                type="button"
                className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-red hover:bg-red-bg"
                onClick={() => onRaiseIssue(h)}
              >
                → Issue
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          action={async () => {
            await addHeadlineAction(meetingId, "employee", employee);
            setEmployee("");
          }}
        >
          <input
            className="eos-input"
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="Nueva noticia del equipo"
          />
          <button type="submit" className="eos-btn eos-btn-secondary">
            +
          </button>
        </form>
      </div>
    </div>
  );
}

function RatingPanel({
  meetingId,
  session,
  ratings,
}: {
  meetingId: number;
  session: SessionPayload;
  ratings: { user_id: number; rating: number; user_name: string }[];
}) {
  const myRating = ratings.find((r) => r.user_id === session.userId)?.rating ?? null;
  const avg =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b.rating, 0) / ratings.length).toFixed(1)
      : null;

  return (
    <div className="eos-card p-5">
      <h4 className="mb-2 font-semibold">Califica esta reunión (1-10)</h4>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`h-9 w-9 rounded-lg text-sm font-semibold ${
              myRating === n
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted hover:bg-border"
            }`}
            onClick={() => rateMeetingAction(meetingId, n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {ratings.length} calificación(es){avg && ` · Promedio: ${avg}`}
      </p>
    </div>
  );
}

export function MeetingRunner({
  meeting,
  session,
  scorecard,
  careerIndicators,
  rocks,
  milestonesByRock,
  members,
  openIssues,
  todos,
  headlines,
  ratings,
  clickupConfigured,
}: {
  meeting: Meeting;
  session: SessionPayload;
  scorecard: {
    owners: ScorecardOwner[];
    metrics: ScorecardMetric[];
    targets: ScorecardTarget[];
    grid: Record<string, number | null>;
    weeks: string[];
  };
  careerIndicators: { rows: CareerRow[]; week: string; weekLabel: string };
  rocks: Rock[];
  milestonesByRock: Record<number, RockMilestone[]>;
  members: PublicUser[];
  openIssues: Issue[];
  todos: Todo[];
  headlines: MeetingHeadline[];
  ratings: { user_id: number; rating: number; user_name: string }[];
  clickupConfigured: boolean;
}) {
  const router = useRouter();
  const idx = segmentIndex(meeting.current_segment);
  const segment = idx >= 0 ? L10_AGENDA[idx] : L10_AGENDA[0];
  const upcoming = nextSegment(meeting.current_segment);
  const elapsed = useElapsed(meeting.segment_started_at);
  const totalElapsed = useElapsed(meeting.started_at);
  const remaining = segment.minutes * 60 - elapsed;
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const memberName = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin dueño";

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  const totalMinutes = useMemo(
    () => L10_AGENDA.reduce((a, s) => a + s.minutes, 0),
    []
  );

  if (meeting.status === "completed") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Reunión #{meeting.id} completada</h1>
        <p className="mt-2 text-sm text-muted">
          Duró {formatClock(totalElapsed)} · Calificación promedio:{" "}
          {meeting.avg_rating ? Number(meeting.avg_rating).toFixed(1) : "-"}/10
        </p>
        <Link href="/meeting" className="eos-btn eos-btn-primary mt-6 inline-flex">
          Volver al historial
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reunión Level 10 · en curso</h1>
        <p className="text-sm text-muted">
          Agenda de {totalMinutes} minutos · Tiempo total: {formatClock(totalElapsed)}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto">
        {L10_AGENDA.map((s, i) => (
          <div
            key={s.key}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              i === idx
                ? "bg-primary text-primary-foreground"
                : i < idx
                ? "bg-green-bg text-green"
                : "bg-card border border-border text-muted"
            }`}
          >
            {i < idx ? "✓ " : ""}
            {s.label} · {s.minutes}m
          </div>
        ))}
      </div>

      <div className="eos-card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-bold">{segment.label}</h2>
          <p className="text-sm text-muted">{segment.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-2xl font-bold tabular-nums ${
              remaining < 0 ? "text-red" : "text-foreground"
            }`}
          >
            {formatClock(remaining)}
          </span>
          {upcoming ? (
            <button
              className="eos-btn eos-btn-primary"
              onClick={() => advanceSegmentAction(meeting.id, upcoming.key)}
            >
              Siguiente: {upcoming.label} →
            </button>
          ) : (
            <button
              className="eos-btn eos-btn-primary"
              onClick={() => completeMeetingAction(meeting.id)}
            >
              Finalizar reunión ✓
            </button>
          )}
        </div>
      </div>

      <QuickCreateBar onCreate={setDraft} />
      {toast && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-green-bg px-3 py-2 text-sm text-green">
          <span>✓ {toast}</span>
          <button className="underline" onClick={() => setToast(null)}>
            Cerrar
          </button>
        </div>
      )}
      {draft && (
        <QuickCreateModal
          key={JSON.stringify(draft)}
          meetingId={meeting.id}
          draft={draft}
          members={members}
          onClose={() => setDraft(null)}
          onCreated={(message) => {
            setDraft(null);
            setToast(message);
          }}
        />
      )}

      <div className="mb-10">
        {segment.key === "segue" && (
          <div className="eos-card p-6 text-sm text-muted">
            Cada persona comparte una buena noticia personal y una del negocio.
            No hay datos que revisar en este segmento. Cuando terminen, avancen
            al Scorecard.
          </div>
        )}

        {segment.key === "scorecard" && (
          <div className="flex flex-col gap-8">
            {scorecard.metrics.length > 0 && scorecard.owners.length > 0 && (
              <ScorecardTable
                owners={scorecard.owners}
                metrics={scorecard.metrics}
                targets={scorecard.targets}
                grid={scorecard.grid}
                weeks={scorecard.weeks}
                onRaiseIssue={(metric, ownerName) =>
                  setDraft({
                    kind: "issue",
                    title: `Indicador fuera de meta: ${metric.name} (${ownerName})`,
                    description: metric.predicts ? `Predice: ${metric.predicts}` : "",
                    source: "Scorecard",
                  })
                }
              />
            )}
            <CareerSummary
              rows={careerIndicators.rows}
              members={members}
              week={careerIndicators.week}
              weekLabel={careerIndicators.weekLabel}
              onRaiseIssue={(r) =>
                setDraft({
                  kind: "issue",
                  title: `Leads bajo meta: ${careerLabel(r)}`,
                  description: `Semana ${careerIndicators.weekLabel}: ${num(r.leads ?? 0)} leads de una meta de ${num(r.leads_goal)}.`,
                  ownerId: r.owner_id,
                  source: "Indicadores de carrera",
                })
              }
            />
          </div>
        )}

        {segment.key === "rocks" && (
          <div className="grid gap-3 md:grid-cols-2">
            {rocks.length === 0 && (
              <p className="text-sm text-muted">No hay Rocks este trimestre.</p>
            )}
            {rocks.map((r) => (
              <RockCard
                key={r.id}
                rock={r}
                milestones={milestonesByRock[r.id] ?? []}
                members={members}
                onRaiseIssue={() =>
                  setDraft({
                    kind: "issue",
                    title: `Rock ${r.status === "off_track" ? "off track" : "a revisar"}: ${r.title}`,
                    description: r.description,
                    ownerId: r.owner_id,
                    source: "Rocks",
                  })
                }
              />
            ))}
          </div>
        )}

        {segment.key === "headlines" && (
          <HeadlinesPanel
            meetingId={meeting.id}
            headlines={headlines}
            onRaiseIssue={(h) => setDraft({ kind: "issue", title: h.content, source: "Noticias" })}
          />
        )}

        {segment.key === "todos" && (
          <TodoList
            todos={todos}
            members={members}
            clickupConfigured={clickupConfigured}
            onRaiseIssue={(t) =>
              setDraft({
                kind: "issue",
                title: `To-Do no cumplido: ${t.title}`,
                description: t.description,
                ownerId: t.owner_id,
                source: "To-Do List",
              })
            }
          />
        )}

        {segment.key === "ids" && (
          <div className="flex flex-col gap-4">
            <div>
              <AddIssueForm members={members} />
            </div>
            <IssueList
              openIssues={openIssues}
              solvedIssues={[]}
              members={members}
              clickupConfigured={clickupConfigured}
              onCreateTodo={(issue) =>
                setDraft({
                  kind: "todo",
                  title: issue.title,
                  description: issue.description
                    ? `${issue.description}\n\nSale del Issue: ${issue.title}`
                    : `Sale del Issue: ${issue.title}`,
                  ownerId: issue.owner_id,
                  source: `IDS · dueño del issue: ${memberName(issue.owner_id)}`,
                })
              }
            />
          </div>
        )}

        {segment.key === "conclude" && (
          <div className="flex flex-col gap-4">
            <div className="eos-card p-5 text-sm text-muted">
              Recapitulen los nuevos to-dos y qué mensajes se deben cascadear al
              resto de la organización.
            </div>
            <RatingPanel meetingId={meeting.id} session={session} ratings={ratings} />
          </div>
        )}
      </div>
    </div>
  );
}
