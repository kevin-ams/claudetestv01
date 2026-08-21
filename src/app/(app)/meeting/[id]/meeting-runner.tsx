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
}: {
  meetingId: number;
  headlines: MeetingHeadline[];
}) {
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Titulares de clientes</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "customer").map((h) => (
            <li key={h.id} className="card p-2">
              {h.content}
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
            className="input"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Nuevo titular de cliente"
          />
          <button type="submit" className="btn btn-secondary">
            +
          </button>
        </form>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Titulares de empleados</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "employee").map((h) => (
            <li key={h.id} className="card p-2">
              {h.content}
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
            className="input"
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="Nuevo titular de empleado"
          />
          <button type="submit" className="btn btn-secondary">
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
    <div className="card p-5">
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
  rocks,
  milestonesByRock,
  members,
  openIssues,
  todos,
  headlines,
  ratings,
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
  rocks: Rock[];
  milestonesByRock: Record<number, RockMilestone[]>;
  members: PublicUser[];
  openIssues: Issue[];
  todos: Todo[];
  headlines: MeetingHeadline[];
  ratings: { user_id: number; rating: number; user_name: string }[];
}) {
  const router = useRouter();
  const idx = segmentIndex(meeting.current_segment);
  const segment = idx >= 0 ? L10_AGENDA[idx] : L10_AGENDA[0];
  const upcoming = nextSegment(meeting.current_segment);
  const elapsed = useElapsed(meeting.segment_started_at);
  const totalElapsed = useElapsed(meeting.started_at);
  const remaining = segment.minutes * 60 - elapsed;

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
        <Link href="/meeting" className="btn btn-primary mt-6 inline-flex">
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

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
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
              className="btn btn-primary"
              onClick={() => advanceSegmentAction(meeting.id, upcoming.key)}
            >
              Siguiente: {upcoming.label} →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => completeMeetingAction(meeting.id)}
            >
              Finalizar reunión ✓
            </button>
          )}
        </div>
      </div>

      <div className="mb-10">
        {segment.key === "segue" && (
          <div className="card p-6 text-sm text-muted">
            Cada persona comparte una buena noticia personal y una del negocio.
            No hay datos que revisar en este segmento — cuando terminen, avancen
            al Scorecard.
          </div>
        )}

        {segment.key === "scorecard" && (
          <ScorecardTable
            owners={scorecard.owners}
            metrics={scorecard.metrics}
            targets={scorecard.targets}
            grid={scorecard.grid}
            weeks={scorecard.weeks}
          />
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
              />
            ))}
          </div>
        )}

        {segment.key === "headlines" && (
          <HeadlinesPanel meetingId={meeting.id} headlines={headlines} />
        )}

        {segment.key === "todos" && <TodoList todos={todos} members={members} />}

        {segment.key === "ids" && (
          <div className="flex flex-col gap-4">
            <AddIssueForm members={members} />
            <IssueList openIssues={openIssues} solvedIssues={[]} members={members} />
          </div>
        )}

        {segment.key === "conclude" && (
          <div className="flex flex-col gap-4">
            <div className="card p-5 text-sm text-muted">
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
