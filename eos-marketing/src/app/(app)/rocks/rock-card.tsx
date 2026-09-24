"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Chip, Input, TextArea, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useState, useTransition } from "react";
import type { Rock, RockMilestone, RockStatus, PublicUser } from "@/lib/domain/types";
import {
  updateRockStatusAction,
  updateRockAction,
  deleteRockAction,
  addMilestoneAction,
  toggleMilestoneAction,
  deleteMilestoneAction,
  setMilestoneDueDateAction,
} from "./actions";

const STATUS_LABEL: Record<RockStatus, string> = {
  on_track: "On track",
  off_track: "Off track",
  done: "Completado",
};

const STATUS_COLOR: Record<RockStatus, "success" | "danger" | "accent"> = {
  on_track: "success",
  off_track: "danger",
  done: "accent",
};

export function RockCard({
  rock,
  milestones,
  members,
  onRaiseIssue,
}: {
  rock: Rock;
  milestones: RockMilestone[];
  members: PublicUser[];
  /** En la reunión L10: convierte el Rock (p. ej. off track) en Issue. */
  onRaiseIssue?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [milestoneInput, setMilestoneInput] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [, startTransition] = useTransition();
  const doneCount = milestones.filter((m) => m.done).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="block gap-0 p-4">
      {editing ? (
        <form
          action={async (fd) => {
            await updateRockAction(rock.id, fd);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <Input fullWidth name="title" required defaultValue={rock.title} />
          <TextArea fullWidth
            name="description"
            className="min-h-16"
            defaultValue={rock.description}
          />
          <AppSelect fullWidth name="ownerId" defaultValue={rock.owner_id ?? "none"}>
            <option value="none">Sin dueño</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </AppSelect>
          <Input fullWidth
            type="date"
            name="dueDate"
            defaultValue={rock.due_date ?? ""}
          />
          <AppCheckbox
            name="isCompanyRock"
            defaultChecked={rock.is_company_rock}
            className="flex items-center gap-2 text-sm"
          >
            Rock de la empresa
          </AppCheckbox>
          <div className="flex gap-2">
            <Button variant="primary" type="submit">
              Guardar
            </Button>
            <Button variant="outline"
              type="button"
              onPress={() => setEditing(false)}
            >
              Cancelar
            </Button>
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
            <Chip size="sm" variant="soft" color={STATUS_COLOR[rock.status]} className="shrink-0">
              {STATUS_LABEL[rock.status]}
            </Chip>
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
                  <AppCheckbox
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
                  <Input
                    type="date"
                    aria-label={`Fecha del hito ${m.title}`}
                    title="Fecha del hito"
                    className={`shadow-none ml-auto rounded border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary ${
                      !m.done && m.due_date && m.due_date < today
                        ? "font-semibold text-red"
                        : "text-muted"
                    }`}
                    defaultValue={m.due_date ?? ""}
                    onChange={(e) =>
                      startTransition(() =>
                        setMilestoneDueDateAction(m.id, e.target.value || null)
                      )
                    }
                  />
                  <Button size="sm" variant="ghost"
                    className="text-xs text-red"
                    onPress={() => startTransition(() => deleteMilestoneAction(m.id))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-2 flex gap-2"
            action={() => {
              if (!milestoneInput.trim()) return;
              const title = milestoneInput.trim();
              const dueDate = milestoneDate || null;
              startTransition(() => addMilestoneAction(rock.id, title, dueDate));
              setMilestoneInput("");
              setMilestoneDate("");
            }}
          >
            <Input fullWidth
              className="min-w-0 flex-1 text-sm"
              placeholder="+ Agregar hito"
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
            />
            <Input fullWidth
              type="date"
              aria-label="Fecha del nuevo hito"
              className="shrink-0 text-sm"
              style={{ width: "9.5rem" }}
              value={milestoneDate}
              onChange={(e) => setMilestoneDate(e.target.value)}
            />
            <Button variant="outline" size="sm" type="submit">
              Agregar
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted">Estado:</span>
            <ToggleButtonGroup
              aria-label="Estado de la roca"
              size="sm"
              disallowEmptySelection
              selectedKeys={[rock.status]}
              onSelectionChange={(keys) => {
                const s = [...keys][0] as RockStatus | undefined;
                if (s && s !== rock.status) startTransition(() => updateRockStatusAction(rock.id, s));
              }}
            >
              {(["on_track", "off_track", "done"] as RockStatus[]).map((s, i) => (
                <ToggleButton key={s} id={s}>
                  {i > 0 && <ToggleButtonGroup.Separator />}
                  {STATUS_LABEL[s]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {onRaiseIssue && (
              <Button size="sm" variant="outline" type="button" className="ml-auto text-[11px] text-red h-6 px-2" onPress={onRaiseIssue}>
                → Issue
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={`${onRaiseIssue ? "" : "ml-auto "}text-primary`}
              onPress={() => setEditing(true)}
            >
              Editar
            </Button>
            <Button size="sm" variant="ghost"
              className="text-red"
              onPress={async () => {
                if (confirm(`¿Eliminar el rock "${rock.title}"?`)) {
                  await deleteRockAction(rock.id);
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
