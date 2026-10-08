"use client";

import { CircleQuestion } from "@gravity-ui/icons";
import { useState } from "react";
import { Button, Popover, Switch } from "@heroui/react";
import { abrirGuia, guiaActivada, reiniciarGuias, setGuiaActivada } from "./preferencias";

/** Botón "Ayuda" del encabezado: ver la guía de la página y activarla o desactivarla. */
export function MenuAyuda({ email }: { email: string }) {
  const [activada, setActivada] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          setActivada(guiaActivada(email));
          setAviso(null);
        }
      }}
    >
      <Button size="sm" variant="tertiary" aria-label="Ayuda y guía" data-guia="ayuda">
        <CircleQuestion aria-hidden className="size-4" />
        Ayuda
      </Button>
      <Popover.Content className="w-80" placement="bottom end">
        <Popover.Dialog className="flex flex-col gap-4">
          <Popover.Heading className="font-semibold">Ayuda</Popover.Heading>
          <ol className="flex flex-col gap-1 text-sm text-muted">
            <li>1. Entra a una <strong className="text-foreground">campaña</strong>.</li>
            <li>2. Abre cada <strong className="text-foreground">arte</strong> pendiente.</li>
            <li>3. <strong className="text-foreground">Aprueba</strong> o marca puntos y <strong className="text-foreground">solicita cambios</strong>.</li>
          </ol>
          <Button size="sm" slot="close" onPress={() => abrirGuia()}>
            Ver la guía de esta página
          </Button>
          <Switch
            isSelected={activada}
            onChange={(v) => {
              setActivada(v);
              setGuiaActivada(email, v);
            }}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-sm">Mostrar guías automáticamente</span>
            </Switch.Content>
          </Switch>
          <button
            type="button"
            className="self-start text-xs text-muted underline hover:text-foreground"
            onClick={() => {
              reiniciarGuias(email);
              setActivada(true);
              setAviso("Las guías se mostrarán de nuevo en cada página.");
            }}
          >
            Repetir todas las guías desde el inicio
          </button>
          {aviso && <p className="text-xs text-success">{aviso}</p>}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
