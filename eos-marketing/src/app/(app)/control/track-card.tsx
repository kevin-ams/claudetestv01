"use client";

import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { PublicUser } from "@/lib/domain/types";
import type { TrackRow } from "@/lib/domain/career-tracks";
import { shortDate, stageInfo, type ControlPlan, type TrackSummary } from "@/lib/domain/career-control";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function StatusToggle({
  status,
  onChange,
}: {
  status: TrackRow["status"];
  onChange: (status: TrackRow["status"]) => void;
}) {
  return (
    // El contenedor frena el clic para no abrir la tarjeta al cambiar el estado.
    <span onClick={(e) => e.stopPropagation()}>
      <ToggleButtonGroup
        aria-label="On track u off track"
        size="sm"
        disallowEmptySelection
        selectedKeys={[status]}
        onSelectionChange={(keys) => {
          const key = [...keys][0] as TrackRow["status"] | undefined;
          if (key && key !== status) onChange(key);
        }}
      >
        <ToggleButton id="on_track" className="h-6 px-2 text-[11px] data-[selected=true]:bg-success data-[selected=true]:text-success-foreground">
          On track
        </ToggleButton>
        <ToggleButton id="off_track" className="h-6 px-2 text-[11px] data-[selected=true]:bg-danger data-[selected=true]:text-danger-foreground">
          <ToggleButtonGroup.Separator />
          Off track
        </ToggleButton>
      </ToggleButtonGroup>
    </span>
  );
}

export function TrackCard({
  plan,
  track,
  summary,
  owner,
  onOpen,
  onStatus,
  onStep,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  plan: ControlPlan;
  track: TrackRow;
  summary: TrackSummary;
  owner: PublicUser | undefined;
  onOpen: () => void;
  onStatus: (status: TrackRow["status"]) => void;
  onStep: (delta: -1 | 1) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const current = summary.current;
  const currentIdx = current ? plan.keys.indexOf(current.key) : -1;
  const stage = current ? stageInfo(plan.milestones[currentIdx].stage) : null;
  const total = plan.milestones.length;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(track.career_id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={`cursor-grab overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        track.status === "off_track" ? "border-red/60" : "border-border"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="h-1" style={{ background: stage?.color ?? "var(--green)" }} />
      <div className="flex flex-col gap-2 p-2.5">
        <div>
          <p className="text-sm font-semibold leading-snug">
            {track.code && <span className="mr-1 font-mono text-xs text-primary">{track.code}</span>}
            {track.name}
          </p>
          <p className="text-[11px] text-muted">{track.program}</p>
        </div>

        {track.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {track.labels.map((l) => (
              <span key={l} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {l}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full"
              style={{ width: `${(summary.doneCount / total) * 100}%`, background: stage?.color ?? "var(--green)" }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted">
            {summary.doneCount}/{total}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {current ? (
            current.late ? (
              <span className="font-semibold text-red">Atrasado · vencía {shortDate(current.plannedEnd)}</span>
            ) : (
              <span className="text-muted">Vence {shortDate(current.plannedEnd)}</span>
            )
          ) : (
            <span className="font-semibold text-green">Todos los hitos completos</span>
          )}
          {summary.launchDelay > 0 && current && (
            <span className="rounded bg-yellow-bg px-1 font-semibold text-yellow">
              Lanz. +{summary.launchDelay} d
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {owner ? initials(owner.name) : "?"}
            </span>
            <span className="truncate text-xs">{owner?.name ?? "Sin responsable"}</span>
          </span>
          <StatusToggle status={track.status} onChange={onStatus} />
        </div>

        <div className="flex justify-between border-t border-border pt-1.5">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Mover al hito anterior"
            className="h-6 w-6 text-xs text-muted"
            isDisabled={summary.doneCount === 0}
            onPress={() => onStep(-1)}
          >
            ◀
          </Button>
          <span className="text-[10px] text-muted">
            {current ? `Hito ${currentIdx + 1}: ${plan.milestones[currentIdx].label}` : "Completado"}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Marcar hito y avanzar"
            className="h-6 w-6 text-xs text-muted"
            isDisabled={!current}
            onPress={() => onStep(1)}
          >
            ▶
          </Button>
        </div>
      </div>
    </div>
  );
}
