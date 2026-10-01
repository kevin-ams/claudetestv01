"use client";

import { groupByOwner, OwnerFilterBar, type OwnerView } from "@/components/owner-filter";
import { Button, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import type { Issue, PublicUser } from "@/lib/domain/types";
import { ClickUpButton } from "@/components/clickup-button";
import {
  moveIssueAction,
  solveIssueAction,
  reopenIssueAction,
  deleteIssueAction,
  setIssueDueDateAction,
  sendIssueToClickUpAction,
} from "./actions";

function ResolveRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="text-xs text-green" onPress={() => setOpen(true)}>
        Resolver
      </Button>
    );
  }

  return (
    <form
      className="flex flex-1 flex-wrap items-center gap-2"
      action={async () => {
        await solveIssueAction(issue.id, followUp);
        setOpen(false);
      }}
    >
      <Input fullWidth
        className="flex-1 text-xs"
        placeholder="To-Do de seguimiento (opcional)"
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
      />
      <Button variant="primary" size="sm" type="submit">
        Confirmar
      </Button>
      <Button variant="outline" size="sm" type="button" onPress={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}

const TERM_LABEL = { short_term: "Corto plazo", long_term: "Largo plazo" };

export function IssueList({
  openIssues,
  solvedIssues,
  members,
  clickupConfigured,
  onCreateTodo,
  currentUserId,
}: {
  openIssues: Issue[];
  solvedIssues: Issue[];
  members: PublicUser[];
  clickupConfigured: boolean;
  /** En la reunión L10: saca un To-Do de este Issue. */
  onCreateTodo?: (issue: Issue) => void;
  /** Si se indica, se muestran primero los de esta persona y aparece el filtro. */
  currentUserId?: number;
}) {
  const [showSolved, setShowSolved] = useState(false);
  const [view, setView] = useState<OwnerView>("mine-first");
  const labels = { mine: "Míos", others: "Del resto del equipo" };
  const groups = groupByOwner(openIssues, view, currentUserId, labels);
  const shown = groups.flatMap((g) => g.items);
  // Las flechas de prioridad solo tienen sentido sobre la lista completa.
  const reorderable = currentUserId === undefined || view === "all";
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {currentUserId !== undefined && (
        <div className="flex flex-col gap-1">
          <OwnerFilterBar view={view} onChange={setView} members={members} userId={currentUserId} />
          {!reorderable && (
            <p className="text-xs text-muted">El número es la prioridad en IDS. Para reordenar prioridades, elige &quot;Todos&quot;.</p>
          )}
        </div>
      )}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Abiertos ({openIssues.length})
        </h2>
        {shown.length === 0 ? (
          <p className="text-sm text-muted">
            {openIssues.length === 0 ? "No hay issues abiertos. 🎉" : "No hay issues abiertos con este filtro."}
          </p>
        ) : (
          groups.map((g) =>
            g.items.length === 0 && g.title ? null : (
          <div key={g.key} className="mb-4">
          {g.title && <h3 className="mb-2 text-xs font-semibold text-muted">{g.title}</h3>}
          <ul className="flex flex-col gap-2">
            {g.items.map((issue) => {
              const idx = openIssues.indexOf(issue);
              return (
              <li key={issue.id} className="card card--default flex flex-row flex-wrap items-center gap-3 p-3">
                <span className="w-6 text-center text-xs font-semibold text-muted">
                  {idx + 1}
                </span>
                {reorderable && <div className="flex flex-col">
                  <Button size="sm" variant="ghost"
                    isDisabled={idx === 0}
                    className="text-xs text-muted"
                    onPress={() => moveIssueAction(issue.id, "up")}
                  >
                    ▲
                  </Button>
                  <Button size="sm" variant="ghost"
                    isDisabled={idx === openIssues.length - 1}
                    className="text-xs text-muted"
                    onPress={() => moveIssueAction(issue.id, "down")}
                  >
                    ▼
                  </Button>
                </div>}
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium">{issue.title}</p>
                  {issue.description && (
                    <p className="text-xs text-muted">{issue.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>
                      {members.find((m) => m.id === issue.owner_id)?.name ?? "Sin dueño"} ·{" "}
                      {TERM_LABEL[issue.term]}
                    </span>
                    <label className="inline-flex items-center gap-1">
                      Fecha:
                      <Input
                        type="date"
                        aria-label={`Fecha de ${issue.title}`}
                        className={`shadow-none rounded border border-transparent bg-transparent px-1 py-0 text-xs hover:border-border focus:border-primary ${
                          issue.due_date && issue.due_date < today ? "font-semibold text-red" : ""
                        }`}
                        defaultValue={issue.due_date ?? ""}
                        onChange={(e) =>
                          startTransition(() => setIssueDueDateAction(issue.id, e.target.value || null))
                        }
                      />
                    </label>
                    {onCreateTodo && (
                      <Button size="sm" variant="outline"
                        type="button"
                        className="text-[11px] text-green h-6 px-2"
                        onPress={() => onCreateTodo(issue)}
                      >
                        + To-Do
                      </Button>
                    )}
                    <ClickUpButton
                      sentUrl={issue.clickup_url}
                      configured={clickupConfigured}
                      onSend={() => sendIssueToClickUpAction(issue.id)}
                    />
                  </div>
                </div>
                <ResolveRow issue={issue} />
                <Button size="sm" variant="ghost"
                  className="text-xs text-red"
                  onPress={() => deleteIssueAction(issue.id)}
                >
                  ✕
                </Button>
              </li>
              );
            })}
          </ul>
          </div>
            )
          )
        )}
      </div>

      <div>
        <Button size="sm" variant="ghost"
          className="text-sm text-primary"
          onPress={() => setShowSolved((v) => !v)}
        >
          {showSolved ? "Ocultar" : "Ver"} resueltos ({solvedIssues.length})
        </Button>
        {showSolved && (
          <ul className="mt-3 flex flex-col gap-2">
            {solvedIssues.map((issue) => (
              <li key={issue.id} className="card card--default flex flex-row items-center gap-3 p-3 opacity-70">
                <div className="flex-1">
                  <p className="font-medium line-through">{issue.title}</p>
                </div>
                <Button size="sm" variant="ghost"
                  className="text-xs text-primary"
                  onPress={() => reopenIssueAction(issue.id)}
                >
                  Reabrir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
