"use client";

import { AppSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";

export type OwnerView = "mine-first" | "mine" | "all" | `user:${number}`;

export type OwnerGroup<T> = { key: string; title: string | null; items: T[] };

/** Ordena/filtra por dueño: primero los de la persona, solo los suyos, todos o los de alguien. */
export function groupByOwner<T extends { owner_id: number | null }>(
  items: T[],
  view: OwnerView,
  userId: number | undefined,
  label: { mine: string; others: string }
): OwnerGroup<T>[] {
  if (userId === undefined || view === "all") return [{ key: "all", title: null, items }];
  if (view.startsWith("user:")) {
    const id = Number(view.slice(5));
    return [{ key: view, title: null, items: items.filter((i) => i.owner_id === id) }];
  }
  const mine = items.filter((i) => i.owner_id === userId);
  if (view === "mine") return [{ key: "mine", title: null, items: mine }];
  return [
    { key: "mine", title: `${label.mine} (${mine.length})`, items: mine },
    { key: "others", title: `${label.others} (${items.length - mine.length})`, items: items.filter((i) => i.owner_id !== userId) },
  ];
}

export function OwnerFilterBar({
  view,
  onChange,
  members,
  userId,
}: {
  view: OwnerView;
  onChange: (v: OwnerView) => void;
  members: { id: number; name: string }[];
  userId: number;
}) {
  const base = view.startsWith("user:") ? null : (view as "mine-first" | "mine" | "all");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        aria-label="Qué mostrar"
        options={[
          { id: "mine-first" as const, label: "Míos primero" },
          { id: "mine" as const, label: "Solo míos" },
          { id: "all" as const, label: "Todos" },
        ]}
        value={base}
        onChange={onChange}
      />
      <AppSelect
        aria-label="Ver los de una persona"
        className="w-48"
        variant="secondary"
        value={view.startsWith("user:") ? view : ""}
        onChange={(e) => onChange((e.target.value || "mine-first") as OwnerView)}
      >
        <option value="">Ver de una persona…</option>
        {members
          .filter((m) => m.id !== userId)
          .map((m) => (
            <option key={m.id} value={`user:${m.id}`}>
              {m.name}
            </option>
          ))}
      </AppSelect>
    </div>
  );
}
