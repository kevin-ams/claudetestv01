"use client";

import { Button, Card } from "@heroui/react";
import { useRef, useState, useTransition } from "react";
import { removeLogoAction, uploadLogoAction, type ThemeResult } from "./actions";

export function LogoSettings({ logoUrl, teamName, canEdit }: { logoUrl: string | null; teamName: string; canEdit: boolean }) {
  const [result, setResult] = useState<ThemeResult | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <Card.Header>
        <Card.Title>Logo de la organización</Card.Title>
        <Card.Description>
          Aparece en la esquina superior izquierda, junto al nombre del equipo. Usa una imagen cuadrada o horizontal (PNG,
          JPG, WEBP o GIF, máx. 5 MB); con fondo transparente se ve mejor en modo claro y oscuro.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 min-w-16 max-w-48 items-center justify-center rounded-lg border border-border bg-background p-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`Logo de ${teamName}`} className="max-h-12 max-w-44 object-contain" />
          ) : (
            <span className="text-xs text-muted">Sin logo</span>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Logo de la organización"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("logo", file);
                start(async () => setResult(await uploadLogoAction(fd)));
                e.target.value = "";
              }}
            />
            <Button variant="secondary" isPending={pending} onPress={() => input.current?.click()}>
              {logoUrl ? "Cambiar logo" : "Subir logo"}
            </Button>
            {logoUrl && (
              <Button variant="ghost" className="text-red" isDisabled={pending} onPress={() => start(async () => setResult(await removeLogoAction()))}>
                Quitar
              </Button>
            )}
          </div>
        )}
        {result && <p className={`w-full text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
      </Card.Content>
    </Card>
  );
}
