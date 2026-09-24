"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Chip, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
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
    <AppSelect name="ownerId" defaultValue={defaultValue ?? "none"} className="w-auto">
      <option value="none">Sin dueño</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </AppSelect>
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
      className="card card--default flex flex-col gap-2 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input fullWidth name="title" required className="min-w-[200px] flex-1" placeholder="Nuevo to-do" />
        <OwnerSelect members={members} defaultValue={null} />
        <Input type="date" name="dueDate" className="w-auto" aria-label="Fecha límite" />
        <Button variant="primary" type="submit">
          Agregar
        </Button>
      </div>
      {showDescription ? (
        <TextArea fullWidth name="description" className="min-h-16" placeholder="Descripción del to-do" autoFocus />
      ) : (
        <Button size="sm" variant="ghost"
          type="button"
          className="self-start text-xs text-primary"
          onPress={() => setShowDescription(true)}
        >
          + Agregar descripción
        </Button>
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
      <li className="card card--default block gap-0 p-3">
        <form
          action={async (fd) => {
            await updateTodoAction(todo.id, fd);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <Input fullWidth name="title" required defaultValue={todo.title} />
          <TextArea fullWidth
            name="description"
            className="min-h-20"
            defaultValue={todo.description}
            placeholder="Descripción del to-do"
          />
          <div className="flex flex-wrap gap-2">
            <OwnerSelect members={members} defaultValue={todo.owner_id} />
            <Input type="date" name="dueDate" className="w-auto" defaultValue={todo.due_date ?? ""} />
            <Button variant="primary" type="submit">
              Guardar
            </Button>
            <Button variant="outline" type="button" onPress={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="card card--default flex flex-row items-start gap-3 p-3">
      <AppCheckbox
        className="mt-0.5"
        aria-label={`Completar ${todo.title}`}
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
            <Button size="sm" variant="outline"
              type="button"
              className="text-[11px] text-red h-6 px-2"
              onPress={() => onRaiseIssue(todo)}
            >
              → Issue
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-primary" onPress={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      </div>
      {isOverdue(todo) && <Chip size="sm" color="danger" variant="soft">Vencido</Chip>}
      <Button size="sm" variant="ghost"
        className="text-xs text-red"
        aria-label={`Eliminar ${todo.title}`}
        onPress={() => startTransition(() => deleteTodoAction(todo.id))}
      >
        ✕
      </Button>
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
            <li key={t.id} className="card card--default flex flex-row items-center gap-3 p-3 opacity-70">
              <AppCheckbox
                defaultChecked
                aria-label={`Reabrir ${t.title}`}
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
