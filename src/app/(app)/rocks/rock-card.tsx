"use client";

import { useState, useTransition } from "react";
import type { Rock, RockMilestone, RockStatus, PublicUser } from "@/lib/domain/types";
import {
  updateRockStatusAction,
  updateRockAction,
  deleteRockAction,
  addMilestoneAction,
  toggleMilestoneAction,
  deleteMilestoneAction,
} from "./actions";

const STATUS_LABEL: Record<RockStatus, string> = {
  on_track: "On track",
  off_track: "Off track",
  done: "Completado",
};

const STATUS_CLASS: Record<RockStatus, string> = {
  on_track: "bg-green-bg text-green",
  off_track: "bg-red-bg text-red",
  done: "bg-primary/10 text-primary",
};

export function RockCard({
  rock,
  milestones,
  members,
}: {
  rock: Rock;
  milestones: RockMilestone[];
  members: PublicUser[];
}) {
  const [editing, setEditing] = useState(false);
  const [milestoneInput, setMilestoneInput] = useState("");
  const [, startTransition] = useTransition();
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <div className="card p-4">
      {editing ? (
        <form
          action={async (fd) => {
            await updateRockAction(rock.id, fd);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <input name="title" required className="input" defaultValue={rock.title} />
          <textarea
            name="description"
            className="input min-h-16"
            defaultValue={rock.description}
          />
          <select name="ownerId" defaultValue={rock.owner_id ?? "none"} className="input">
            <option value="none">Sin dueño</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="dueDate"
            className="input"
            defaultValue={rock.due_date ?? ""}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isCompanyRock"
              defaultChecked={rock.is_company_rock}
            />
            Rock de la empresa
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{rock.title}</p>
              {rock.description && (
                <p className="mt-0.5 text-sm text-muted">{rock.description}</p>
              )}
            </div>
            <span className={`badge shrink-0 ${STATUS_CLASS[rock.status]}`}>
              {STATUS_LABEL[rock.status]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              {members.find((m) => m.id === rock.owner_id)?.name ?? "Sin dueño"}
            </span>
            {rock.due_date && <span>· Vence {rock.due_date}</span>}
            {milestones.length > 0 && (
              <span>
                · {doneCount}/{milestones.length} hitos
              </span>
            )}
          </div>

          {milestones.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={(e) =>
                      startTransition(() =>
                        toggleMilestoneAction(m.id, e.target.checked)
                      )
                    }
                  />
                  <span className={m.done ? "text-muted line-through" : ""}>
                    {m.title}
                  </span>
                  <button
                    className="ml-auto text-xs text-red"
                    onClick={() => startTransition(() => deleteMilestoneAction(m.id))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-2 flex gap-2"
            action={() => {
              if (!milestoneInput.trim()) return;
              startTransition(() => addMilestoneAction(rock.id, milestoneInput.trim()));
              setMilestoneInput("");
            }}
          >
            <input
              className="input text-sm"
              placeholder="+ Agregar hito"
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary text-xs">
              Agregar
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted">Estado:</span>
            {(["on_track", "off_track", "done"] as RockStatus[]).map((s) => (
              <button
                key={s}
                className={`badge ${
                  rock.status === s ? STATUS_CLASS[s] : "bg-background text-muted"
                }`}
                onClick={() => startTransition(() => updateRockStatusAction(rock.id, s))}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              className="ml-auto font-medium text-primary underline"
              onClick={() => setEditing(true)}
            >
              Editar
            </button>
            <button
              className="font-medium text-red underline"
              onClick={async () => {
                if (confirm(`¿Eliminar el rock "${rock.title}"?`)) {
                  await deleteRockAction(rock.id);
                }
              }}
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
