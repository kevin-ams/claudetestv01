"use client";

import { useTransition } from "react";
import { switchTeamAction } from "@/lib/auth/actions";

/** Selector de equipo (aparece cuando la persona pertenece a más de uno, p. ej. con la demo). */
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
      value={currentTeamId}
      disabled={pending}
      aria-label="Cambiar de equipo"
      className="input ml-2 !w-auto text-xs"
      onChange={(e) => {
        const teamId = Number(e.target.value);
        startTransition(() => switchTeamAction(teamId));
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
