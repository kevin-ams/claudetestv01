"use client";

import { ArrowShapeTurnUpRight } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { todoTeamOptionsAction, type TeamOption } from "@/app/(app)/todos/actions";

type Result = { ok: boolean; message: string };
export type TeamSendInput = { teamId: number; ownerId: number | null; dueDate: string | null; notify: boolean; move: boolean };

// Los equipos se piden una vez por visita a la página.
let optionsPromise: ReturnType<typeof todoTeamOptionsAction> | null = null;

/** "Enviar a otro equipo": se elige el equipo, su responsable y la fecha límite. */
export function TeamSendButton({
  ownerEmail,
  dueDate,
  onSend,
}: {
  ownerEmail?: string | null;
  dueDate: string | null;
  onSend: (input: TeamSendInput) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [teamId, setTeamId] = useState("-");
  const [owner, setOwner] = useState("-");
  const [due, setDue] = useState(dueDate?.slice(0, 10) ?? "");
  const [notify, setNotify] = useState(true);
  const [move, setMove] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, startLoad] = useTransition();
  const [pending, startSend] = useTransition();

  const openPanel = () =>
    startLoad(async () => {
      setOpen(true);
      setResult(null);
      try {
        optionsPromise ??= todoTeamOptionsAction();
        const r = await optionsPromise;
        setTeams(r.teams);
        setEmailEnabled(r.emailEnabled);
      } catch {
        optionsPromise = null;
        setResult({ ok: false, message: "No se pudieron leer los equipos. Si se publicó una versión nueva, recarga la página." });
      }
    });

  const pickTeam = (value: string) => {
    setTeamId(value);
    // Si el responsable actual también está en ese equipo, se sugiere.
    const t = teams?.find((x) => String(x.id) === value);
    const match = ownerEmail ? t?.members.find((m) => m.email.toLowerCase() === ownerEmail.toLowerCase()) : undefined;
    setOwner(match ? String(match.id) : "-");
  };

  if (!open) {
    return (
      <>
        <Button size="sm" variant="outline" onPress={openPanel}>
          <ArrowShapeTurnUpRight aria-hidden /> Enviar a otro equipo
        </Button>
        {result?.ok && <span className="text-xs text-green">{result.message}</span>}
      </>
    );
  }

  const team = teams?.find((t) => String(t.id) === teamId);
  return (
    <span className="flex w-full flex-col gap-2 rounded-lg border border-border bg-background p-2">
      {loading && !teams ? (
        <span className="text-xs text-muted">Leyendo equipos…</span>
      ) : teams && teams.length === 0 ? (
        <span className="text-xs text-muted">No hay otros equipos a los que enviar.</span>
      ) : teams ? (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <AppSelect aria-label="Equipo" className="w-48" value={teamId} onChange={(e) => pickTeam(e.target.value)}>
              <option value="-">Equipo…</option>
              {teams.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </AppSelect>
            <AppSelect aria-label="Responsable en ese equipo" className="w-48" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!team}>
              <option value="-">Sin responsable</option>
              {(team?.members ?? []).map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </AppSelect>
            <Input aria-label="Fecha límite" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {emailEnabled && (
              <AppCheckbox checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={owner === "-"}>
                <span className="text-xs">Avisar por correo al responsable</span>
              </AppCheckbox>
            )}
            <AppCheckbox checked={move} onChange={(e) => setMove(e.target.checked)}>
              <span className="text-xs">Quitarlo de este equipo (mover)</span>
            </AppCheckbox>
          </span>
        </>
      ) : null}
      <span className="flex gap-2">
        {teams && teams.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            isDisabled={pending || teamId === "-"}
            onPress={() =>
              startSend(async () => {
                const r = await onSend({
                  teamId: Number(teamId),
                  ownerId: owner === "-" ? null : Number(owner),
                  dueDate: due || null,
                  notify: notify && owner !== "-",
                  move,
                }).catch(() => ({ ok: false, message: "No se pudo enviar. Si se publicó una versión nueva, recarga la página." }));
                setResult(r);
                if (r.ok) setOpen(false);
              })
            }
          >
            {pending ? "Enviando…" : move ? "Mover" : "Enviar"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onPress={() => setOpen(false)} isDisabled={pending}>
          Cancelar
        </Button>
      </span>
      {result && !result.ok && <span className="text-xs text-red">{result.message}</span>}
    </span>
  );
}
