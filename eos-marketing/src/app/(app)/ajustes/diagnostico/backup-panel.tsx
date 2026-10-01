"use client";

import { useState, useTransition } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { ProgressBar } from "@/components/progress-bar";
import { restoreBackupAction, type RestoreResult } from "./actions";

export type BackupEvent = { kind: "download" | "restore"; user_name: string; detail: string; created_at: string; when: string };

const ALERT_DAYS = 7;

export function BackupPanel({
  events,
  canEdit,
  days,
}: {
  events: BackupEvent[];
  canEdit: boolean;
  /** Días desde el último respaldo descargado (calculado en el servidor). */
  days: number | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [pending, startTransition] = useTransition();
  const last = events.find((e) => e.kind === "download");
  const stale = days === null || days >= ALERT_DAYS;

  return (
    <Card>
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <Card.Title>Respaldos</Card.Title>
          <Card.Description>
            Archivo con toda la información (todos los equipos): personas, metas, indicadores, Rocks, To-Dos, Issues,
            reuniones, roles y log. No incluye las imágenes de anuncios.
          </Card.Description>
        </div>
        <Chip size="sm" variant="soft" color={stale ? "warning" : "success"}>
          {last ? `Último respaldo: hace ${days === 0 ? "menos de un día" : `${days} día(s)`}` : "Sin respaldos"}
        </Chip>
      </Card.Header>
      <Card.Content className="gap-4">
        {stale && (
          <p role="alert" className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
            {last
              ? `⚠ Han pasado ${days} días desde el último respaldo. Se recomienda descargar uno cada semana.`
              : "⚠ Todavía no se ha descargado ningún respaldo. Descarga uno y guárdalo en un lugar seguro."}
          </p>
        )}

        {canEdit ? (
          <a href="/api/respaldo" className={`${buttonVariants({ variant: "primary" })} self-start`}>
            ⬇ Descargar respaldo ahora
          </a>
        ) : (
          <p className="text-sm text-muted">Solo un administrador puede descargar o restaurar respaldos.</p>
        )}
        <p className="text-xs text-muted">
          El archivo (.json.gz) incluye los accesos de las personas (con las contraseñas cifradas): guárdalo en un lugar
          privado.
        </p>

        {canEdit && (
          <form
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              fd.set("confirm", confirm);
              startTransition(async () => setResult(await restoreBackupAction(fd)));
            }}
          >
            <p className="text-sm font-semibold">Restaurar una copia anterior</p>
            <p className="text-xs text-muted">
              Reemplaza <b>toda</b> la información actual por la del archivo. Descarga primero un respaldo de lo actual por
              si necesitas volver.
            </p>
            <label className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer self-start`}>
              {file ? `Archivo: ${file.name}` : "Elegir archivo de respaldo"}
              <input
                type="file"
                accept=".gz,.json,application/gzip,application/json"
                className="sr-only"
                aria-label="Archivo de respaldo"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
            </label>
            <Input
              aria-label="Confirmación"
              placeholder='Escribe RESTAURAR para confirmar'
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="max-w-xs"
            />
            <Button
              type="submit"
              variant="danger"
              className="self-start"
              isDisabled={!file || confirm.trim().toUpperCase() !== "RESTAURAR"}
              isPending={pending}
            >
              Restaurar respaldo
            </Button>
            {pending && <ProgressBar label="Restaurando… no cierres esta página." />}
            {result && (
              <p role="status" className={`rounded-md px-2 py-1 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}>
                {result.ok ? "✓ " : "✕ "}
                {result.message}
              </p>
            )}
          </form>
        )}

        {events.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Historial</p>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {events.map((e, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    {e.kind === "download" ? "⬇ Descargado" : "↺ Restaurado"} por {e.user_name}
                    <span className="text-muted"> · {e.detail}</span>
                  </span>
                  <span className="text-muted">{e.when}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
