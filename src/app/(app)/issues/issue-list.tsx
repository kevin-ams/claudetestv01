"use client";

import { useState } from "react";
import type { Issue, PublicUser } from "@/lib/domain/types";
import { SectionTitle } from "@/components/page-header";
import {
  moveIssueAction,
  solveIssueAction,
  reopenIssueAction,
  deleteIssueAction,
} from "./actions";

function ResolveRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");

  if (!open) {
    return (
      <button className="text-xs font-medium text-green underline" onClick={() => setOpen(true)}>
        Resolver
      </button>
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
      <input
        className="input flex-1 text-xs"
        placeholder="To-Do de seguimiento (opcional)"
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
      />
      <button type="submit" className="btn btn-primary text-xs">
        Confirmar
      </button>
      <button type="button" className="btn btn-secondary text-xs" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </form>
  );
}

const TERM_LABEL = { short_term: "Corto plazo", long_term: "Largo plazo" };

export function IssueList({
  openIssues,
  solvedIssues,
  members,
}: {
  openIssues: Issue[];
  solvedIssues: Issue[];
  members: PublicUser[];
}) {
  const [showSolved, setShowSolved] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionTitle count={openIssues.length}>Abiertos</SectionTitle>
        {openIssues.length === 0 ? (
          <p className="tile p-6 text-center text-sm text-muted">No hay issues abiertos. 🎉</p>
        ) : (
          <ul className="stagger flex flex-col gap-2">
            {openIssues.map((issue, idx) => (
              <li
                key={issue.id}
                className={`${issue.term === "long_term" ? "tone-vto" : "tone-issues"} card lift accent-left flex flex-wrap items-center gap-3 p-3`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    idx < 3 ? "icon-chip-solid" : "bg-tone-soft text-tone"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex flex-col">
                  <button
                    disabled={idx === 0}
                    className="text-xs text-muted disabled:opacity-30"
                    onClick={() => moveIssueAction(issue.id, "up")}
                  >
                    ▲
                  </button>
                  <button
                    disabled={idx === openIssues.length - 1}
                    className="text-xs text-muted disabled:opacity-30"
                    onClick={() => moveIssueAction(issue.id, "down")}
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium">{issue.title}</p>
                  {issue.description && (
                    <p className="text-xs text-muted">{issue.description}</p>
                  )}
                  <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    {members.find((m) => m.id === issue.owner_id)?.name ?? "Sin dueño"}
                    <span className="bg-tone-soft text-tone rounded-full px-2 py-0.5 font-semibold">
                      {TERM_LABEL[issue.term]}
                    </span>
                  </p>
                </div>
                <ResolveRow issue={issue} />
                <button
                  className="text-xs text-red"
                  onClick={() => deleteIssueAction(issue.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          className="text-sm font-medium text-primary underline"
          onClick={() => setShowSolved((v) => !v)}
        >
          {showSolved ? "Ocultar" : "Ver"} resueltos ({solvedIssues.length})
        </button>
        {showSolved && (
          <ul className="mt-3 flex flex-col gap-2">
            {solvedIssues.map((issue) => (
              <li key={issue.id} className="tone-green card accent-left flex items-center gap-3 p-3 opacity-70">
                <div className="flex-1">
                  <p className="font-medium line-through">{issue.title}</p>
                </div>
                <button
                  className="text-xs text-primary underline"
                  onClick={() => reopenIssueAction(issue.id)}
                >
                  Reabrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
