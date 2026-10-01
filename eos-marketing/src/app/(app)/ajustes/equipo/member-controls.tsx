"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { removeMemberAction, setMemberRoleAction, type MemberResult } from "./actions";

/** Rol de la persona (solo administradores lo cambian) y botón para quitarla del equipo. */
export function MemberControls({
  userId,
  name,
  roleId,
  roles,
  isSelf,
}: {
  userId: number;
  name: string;
  roleId: number | null;
  roles: { id: number; name: string }[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<MemberResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<MemberResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <AppSelect
          aria-label={`Rol de ${name}`}
          className="w-40"
          value={roleId ?? ""}
          disabled={pending}
          onChange={(e) => e.target.value && run(() => setMemberRoleAction(userId, Number(e.target.value)))}
        >
          {roleId === null && <option value="">Sin rol</option>}
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </AppSelect>
        {!isSelf && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red"
            isDisabled={pending}
            onPress={() => {
              if (confirm(`¿Quitar a ${name} de este equipo? Su cuenta sigue existiendo.`)) run(() => removeMemberAction(userId));
            }}
          >
            Quitar
          </Button>
        )}
      </div>
      {result && !result.ok && <span className="text-xs text-red">{result.message}</span>}
    </div>
  );
}
