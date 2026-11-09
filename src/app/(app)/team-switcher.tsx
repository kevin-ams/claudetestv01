"use client";

import { useTransition } from "react";
import { switchTeamAction } from "@/lib/auth/actions";

export function TeamSwitcher({
  currentTeamId,
  teams,
}: {
  currentTeamId: number;
  teams: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Cambiar de equipo"
      defaultValue={currentTeamId}
      disabled={pending}
      className="input ml-2 !w-auto !py-1 text-xs"
      onChange={(e) => {
        const id = Number(e.currentTarget.value);
        startTransition(() => switchTeamAction(id));
      }}
    >
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
