"use client";

import { useTransition } from "react";
import type { Todo, PublicUser } from "@/lib/domain/types";
import { completeTodoAction, deleteTodoAction, createTodoAction } from "./actions";

function isOverdue(todo: Todo) {
  return (
    todo.status === "open" &&
    todo.due_date !== null &&
    new Date(todo.due_date) < new Date(new Date().toDateString())
  );
}

export function TodoList({
  todos,
  members,
}: {
  todos: Todo[];
  members: PublicUser[];
}) {
  const [, startTransition] = useTransition();
  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-6">
      <form action={createTodoAction} className="card flex flex-wrap items-center gap-2 p-4">
        <input name="title" required className="input flex-1 min-w-[200px]" placeholder="Nuevo to-do" />
        <select name="ownerId" defaultValue="none" className="input !w-auto">
          <option value="none">Sin dueño</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input type="date" name="dueDate" className="input !w-auto" />
        <button type="submit" className="btn btn-primary">
          Agregar
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Pendientes ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No hay to-dos pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((t) => (
              <li key={t.id} className="card flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  onChange={(e) =>
                    startTransition(() => completeTodoAction(t.id, e.target.checked))
                  }
                />
                <div className="flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {members.find((m) => m.id === t.owner_id)?.name ?? "Sin dueño"}
                    {t.due_date && ` · Vence ${t.due_date}`}
                  </p>
                </div>
                {isOverdue(t) && <span className="badge bg-red-bg text-red">Vencido</span>}
                <button className="text-xs text-red" onClick={() => deleteTodoAction(t.id)}>
                  ✕
                </button>
              </li>
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
                onChange={(e) =>
                  startTransition(() => completeTodoAction(t.id, e.target.checked))
                }
              />
              <p className="flex-1 font-medium line-through">{t.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
