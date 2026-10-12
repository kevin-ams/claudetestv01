"use client";

import { ChevronDown, ChevronUp, Pencil, Star, StarFill, Xmark } from "@gravity-ui/icons";
import { groupByOwner, OwnerFilterBar, type OwnerView } from "@/components/owner-filter";
import { Button, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useRouter } from "next/navigation";
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
  toggleIssueTopAction,
  updateIssueAction,
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
const TOP_LIMIT = 3;

function EditIssueForm({ issue, members, onDone }: { issue: Issue; members: PublicUser[]; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await updateIssueAction(issue.id, fd);
          if (!r.ok) return setError(r.message);
          router.refresh();
          onDone();
        });
      }}
    >
      <Input fullWidth name="title" required defaultValue={issue.title} aria-label="Título del issue" />
      <TextArea fullWidth name="description" className="min-h-16" defaultValue={issue.description} placeholder="Detalle (opcional)" aria-label="Detalle" />
      <div className="flex flex-wrap gap-2">
        <AppSelect className="w-auto" name="ownerId" defaultValue={issue.owner_id ? String(issue.owner_id) : "none"} aria-label="Dueño">
          <option value="none">Sin dueño</option>
          {members.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name}
            </option>
          ))}
        </AppSelect>
        <AppSelect className="w-auto" name="term" defaultValue={issue.term} aria-label="Plazo">
          <option value="short_term">Corto plazo</option>
          <option value="long_term">Largo plazo</option>
        </AppSelect>
        <Input type="date" name="dueDate" className="w-auto" defaultValue={issue.due_date ?? ""} aria-label="Fecha" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" type="submit" isDisabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="outline" size="sm" type="button" onPress={onDone} isDisabled={pending}>
          Cancelar
        </Button>
        {error && <span className="text-xs text-red">{error}</span>}
      </div>
    </form>
  );
}

function IssueRow({
  issue,
  number,
  members,
  clickupConfigured,
  onCreateTodo,
  canMoveUp,
  canMoveDown,
  topFull,
}: {
  issue: Issue;
  number: number;
  members: PublicUser[];
  clickupConfigured: boolean;
  onCreateTodo?: (issue: Issue) => void;
  canMoveUp: boolean | null;
  canMoveDown: boolean | null;
  topFull: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const isTop = issue.top_rank !== null;

  if (editing) {
    return (
      <li className="card card--default p-3">
        <EditIssueForm issue={issue} members={members} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`card card--default flex flex-row flex-wrap items-center gap-3 p-3 ${isTop ? "ring-1 ring-primary/50" : ""}`}>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isTop ? "bg-primary text-primary-foreground" : "text-muted"
        }`}
        title={isTop ? `Top ${issue.top_rank} de la L10` : "Prioridad"}
      >
        {number}
      </span>
      {canMoveUp !== null && (
        <div className="flex flex-col">
          <Button size="sm" variant="ghost" isDisabled={!canMoveUp || pending} className="text-xs text-muted" aria-label="Subir" onPress={() => startTransition(() => moveIssueAction(issue.id, "up"))}>
            <ChevronUp aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" isDisabled={!canMoveDown || pending} className="text-xs text-muted" aria-label="Bajar" onPress={() => startTransition(() => moveIssueAction(issue.id, "down"))}>
            <ChevronDown aria-hidden />
          </Button>
        </div>
      )}
      <div className="min-w-[180px] flex-1">
        <p className="font-medium">{issue.title}</p>
        {issue.description && <p className="whitespace-pre-line text-xs text-muted">{issue.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>
            {members.find((m) => m.id === issue.owner_id)?.name ?? "Sin dueño"} · {TERM_LABEL[issue.term]}
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
              onChange={(e) => startTransition(() => setIssueDueDateAction(issue.id, e.target.value || null))}
            />
          </label>
          {onCreateTodo && (
            <Button size="sm" variant="outline" type="button" className="h-6 px-2 text-[11px] text-green" onPress={() => onCreateTodo(issue)}>
              + To-Do
            </Button>
          )}
          <ClickUpButton
            sentUrl={issue.clickup_url}
            configured={clickupConfigured}
            ownerEmail={members.find((m) => m.id === issue.owner_id)?.email ?? null}
            onSend={(target) => sendIssueToClickUpAction(issue.id, target)}
          />
        </div>
        {message && <p className="mt-1 text-xs text-red">{message}</p>}
      </div>
      <Button
        size="sm"
        variant={isTop ? "primary" : "outline"}
        isDisabled={pending}
        aria-pressed={isTop}
        aria-label={isTop ? "Quitar del Top 3" : topFull ? "Ya hay 3 en el Top 3" : "Marcar en el Top 3 de la L10"}
        onPress={() =>
          startTransition(async () => {
            const r = await toggleIssueTopAction(issue.id, !isTop);
            setMessage(r.ok ? "" : r.message);
            router.refresh();
          })
        }
      >
        {isTop ? <StarFill aria-hidden /> : <Star aria-hidden />}
        {isTop ? `Top ${issue.top_rank}` : "Top 3"}
      </Button>
      <Button size="sm" variant="ghost" onPress={() => setEditing(true)} aria-label={`Editar ${issue.title}`}>
        <Pencil aria-hidden /> Editar
      </Button>
      <ResolveRow issue={issue} />
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-red"
        aria-label={`Eliminar ${issue.title}`}
        onPress={() => {
          if (confirm(`¿Eliminar el issue “${issue.title}”?`)) startTransition(() => deleteIssueAction(issue.id));
        }}
      >
        <Xmark aria-hidden />
      </Button>
    </li>
  );
}

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
  const top = openIssues.filter((i) => i.top_rank !== null).sort((a, b) => (a.top_rank ?? 0) - (b.top_rank ?? 0));
  const rest = openIssues.filter((i) => i.top_rank === null);
  const labels = { mine: "Míos", others: "Del resto del equipo" };
  const groups = groupByOwner(rest, view, currentUserId, labels);
  const shown = groups.flatMap((g) => g.items);
  // Las flechas de prioridad solo tienen sentido sobre la lista completa.
  const reorderable = currentUserId === undefined || view === "all";
  const topFull = top.length >= TOP_LIMIT;
  const rowProps = { members, clickupConfigured, onCreateTodo, topFull };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <StarFill aria-hidden /> Top 3 para la L10 ({top.length}/{TOP_LIMIT})
        </h2>
        <p className="mb-3 text-xs text-muted">Los primeros que se discuten en el IDS. Márcalos con el botón “Top 3” de cada issue.</p>
        {top.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay issues en el Top 3.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} number={i + 1} canMoveUp={i > 0} canMoveDown={i < top.length - 1} {...rowProps} />
            ))}
          </ul>
        )}
      </section>

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
          Abiertos ({rest.length}{top.length ? ` + ${top.length} en el Top 3` : ""})
        </h2>
        {shown.length === 0 ? (
          <p className="text-sm text-muted">{openIssues.length === 0 ? "No hay issues abiertos." : "No hay más issues abiertos con este filtro."}</p>
        ) : (
          groups.map((g) =>
            g.items.length === 0 && g.title ? null : (
              <div key={g.key} className="mb-4">
                {g.title && <h3 className="mb-2 text-xs font-semibold text-muted">{g.title}</h3>}
                <ul className="flex flex-col gap-2">
                  {g.items.map((issue) => {
                    const idx = rest.indexOf(issue);
                    return (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        number={top.length + idx + 1}
                        canMoveUp={reorderable ? idx > 0 : null}
                        canMoveDown={reorderable ? idx < rest.length - 1 : null}
                        {...rowProps}
                      />
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
