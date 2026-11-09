"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input } from "@heroui/react";
import { switchTeamAction } from "@/lib/auth/actions";
import { createTeamAction, importGesTeamAction, type TeamResult } from "./actions";

export function SwitchTeamButton({ teamId }: { teamId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="outline" isPending={pending} onPress={() => startTransition(() => switchTeamAction(teamId))}>
      Cambiar a este equipo
    </Button>
  );
}

export function NewTeamForm() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<TeamResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <Card.Header>
        <Card.Title>Crear equipo</Card.Title>
        <Card.Description>
          Empieza vacío. Quedarás como Administrador y podrás agregar personas en Ajustes › Equipo.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createTeamAction(name);
              if (res) setResult(res);
            });
          }}
        >
          <Input
            aria-label="Nombre del equipo"
            placeholder="Ej. Marketing digital, Admisiones…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-64 flex-1"
          />
          <Button type="submit" isPending={pending}>
            Crear y entrar
          </Button>
        </form>
        {result && !result.ok && <p className="mt-2 text-sm text-red">{result.message}</p>}
      </Card.Content>
    </Card>
  );
}

export function GesTemplateCard() {
  const [result, setResult] = useState<TeamResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <Card.Header>
        <Card.Title>Plantilla: Comunicación GES</Card.Title>
        <Card.Description>
          Crea el equipo Comunicación GES contigo como Administrador, Cesar y David (con correo provisional: define su
          correo y contraseña reales en Ajustes › Equipo), e importa el plan de contenido: calendario editorial Ago–Oct,
          banco Hygiene, días internacionales, registro de coberturas y los 16 indicadores del Scorecard con sus metas y
          valores semanales.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Button
          variant="secondary"
          isPending={pending}
          onPress={() =>
            startTransition(async () => {
              const res = await importGesTeamAction();
              if (res) setResult(res);
            })
          }
        >
          Crear equipo e importar datos
        </Button>
        {result && !result.ok && <p className="mt-2 text-sm text-red">{result.message}</p>}
      </Card.Content>
    </Card>
  );
}
