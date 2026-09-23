"use client";

import { useState, useTransition } from "react";
import type { Todo, PublicUser } from "@/lib/domain/types";
import { ClickUpButton } from "@/components/clickup-button";
import {
  completeTodoAction,
  deleteTodoAction,
  createTodoAction,
  updateTodoAction,
  sendTodoToClickUpAction,
} from "./actions";

function isOverdue(todo: Todo) {
  return (
    todo.status === "open" &&
    todo.due_date !== null &&
    new Date(todo.due_date) < new Date(new Date().toDateString())
  );
}

function OwnerSelect({ members, defaultValue }: { members: PublicUser[]; defaultValue: number | null }) {
  return (
    <select name="ownerId" defaultValue={defaultValue ?? "none"} className="input !w-auto">
      <option value="none">Sin dueño</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function AddTodoForm({ members }: { members: PublicUser[] }) {
  const [showDescription, setShowDescription] = useState(false);
  return (
    <form
      action={async (fd) => {
        await createTodoAction(fd);
        setShowDescription(false);
      }}
      className="card flex flex-col gap-2 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input name="title" required className="input min-w-[200px] flex-1" placeholder="Nuevo to-do" />
        <OwnerSelect members={members} defaultValue={null} />
        <input type="date" name="dueDate" className="input !w-auto" aria-label="Fecha límite" />
        <button type="submit" className="btn btn-primary">
          Agregar
        </button>
      </div>
      {showDescription ? (
        <textarea name="description" className="input min-h-16" placeholder="Descripción del to-do" autoFocus />
      ) : (
        <button
          type="button"
          className="self-start text-xs font-medium text-primary underline"
          onClick={() => setShowDescription(true)}
        >
          + Agregar descripción
        </button>
      )}
    </form>
  );
}

function TodoItem({
  todo,
  members,
  clickupConfigured,
  onRaiseIssue,
}: {
  todo: Todo;
  members: PublicUser[];
  clickupConfigured: boolean;
  onRaiseIssue?: (todo: Todo) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="card p-3">
        <form
          action={async (fd) => {
            await updateTodoAction(todo.id, fd);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <input name="title" required className="input" defaultValue={todo.title} />
          <textarea
            name="description"
            className="input min-h-20"
            defaultValue={todo.description}
            placeholder="Descripción del to-do"
          />
          <div className="flex flex-wrap gap-2">
            <OwnerSelect members={members} defaultValue={todo.owner_id} />
            <input type="date" name="dueDate" className="input !w-auto" defaultValue={todo.due_date ?? ""} />
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="card flex items-start gap-3 p-3">
      <input
        type="checkbox"
        className="mt-1"
        onChange={(e) => startTransition(() => completeTodoAction(todo.id, e.target.checked))}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{todo.title}</p>
        {todo.description && (
          <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{todo.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            {members.find((m) => m.id === todo.owner_id)?.name ?? "Sin dueño"}
            {todo.due_date && ` · Vence ${todo.due_date}`}
          </span>
          <ClickUpButton
            sentUrl={todo.clickup_url}
            configured={clickupConfigured}
            onSend={() => sendTodoToClickUpAction(todo.id)}
          />
          {onRaiseIssue && (
            <button
              type="button"
              className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-red hover:bg-red-bg"
              onClick={() => onRaiseIssue(todo)}
            >
              → Issue
            </button>
          )}
          <button className="font-medium text-primary underline" onClick={() => setEditing(true)}>
            Editar
          </button>
        </div>
      </div>
      {isOverdue(todo) && <span className="badge bg-red-bg text-red">Vencido</span>}
      <button
        className="text-xs text-red"
        aria-label={`Eliminar ${todo.title}`}
        onClick={() => startTransition(() => deleteTodoAction(todo.id))}
      >
        ✕
      </button>
    </li>
  );
}

export function TodoList({
  todos,
  members,
  clickupConfigured,
  onRaiseIssue,
}: {
  todos: Todo[];
  members: PublicUser[];
  clickupConfigured: boolean;
  /** En la reunión L10: un To-Do no cumplido puede pasar a IDS. */
  onRaiseIssue?: (todo: Todo) => void;
}) {
  const [, startTransition] = useTransition();
  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-6">
      <AddTodoForm members={members} />

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Pendientes ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No hay to-dos pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                members={members}
                clickupConfigured={clickupConfigured}
                onRaiseIssue={onRaiseIssue}
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Completados ({done.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {done.map((t) => (
            <li key={t.id} className="card flex items-center gap-3 p-3 opacity-70">
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => startTransition(() => completeTodoAction(t.id, e.target.checked))}
              />
              <p className="flex-1 font-medium line-through">{t.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
