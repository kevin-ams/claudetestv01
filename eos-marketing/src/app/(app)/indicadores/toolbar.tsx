"use client";

import { Button, Chip, Input, Tooltip } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Career, PublicUser } from "@/lib/domain/types";
import { CAREER_LEVELS } from "@/lib/domain/careers-shared";
import { shiftWeek } from "@/lib/utils/dates";
import { createCareerAction, syncActiveCampaignAction, type ActionResult } from "./actions";
import { BudgetImporter } from "./budget-importer";

type Panel = "import" | "add" | null;

export function Toolbar({
  week,
  weekLabel,
  defaultWeek,
  careers,
  aliases,
  members,
  programs,
  acConfigured,
}: {
  week: string;
  weekLabel: string;
  defaultWeek: string;
  careers: Pick<Career, "id" | "code" | "name">[];
  aliases: Record<string, number>;
  members: PublicUser[];
  programs: string[];
  acConfigured: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [panel, setPanel] = useState<Panel>(null);
  const [syncResult, setSyncResult] = useState<ActionResult | null>(null);
  const [syncing, startSync] = useTransition();

  function weekHref(target: string) {
    const next = new URLSearchParams(params.toString());
    next.set("semana", target);
    return `/indicadores?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Link href={weekHref(shiftWeek(week, -1))} className="rounded px-2 py-1 text-sm hover:bg-background" aria-label="Semana anterior">
            ←
          </Link>
          <span className="px-2 text-sm font-semibold">{weekLabel}</span>
          <Link href={weekHref(shiftWeek(week, 1))} className="rounded px-2 py-1 text-sm hover:bg-background" aria-label="Semana siguiente">
            →
          </Link>
        </div>
        {week !== defaultWeek && (
          <Link href={weekHref(defaultWeek)} className="text-sm text-primary underline">
            Ir a la última semana cerrada
          </Link>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Tooltip delay={300}>
            <Button variant="outline"
              className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left"
              isDisabled={syncing}
              onPress={() =>
                startSync(async () => {
                  setSyncResult(await syncActiveCampaignAction(week));
                  router.refresh();
                })
              }
            >
              {syncing ? "Actualizando..." : "↻ Actualizar leads desde ActiveCampaign"}
              {!acConfigured && <Chip size="sm" color="warning" variant="soft">Pendiente</Chip>}
            </Button>
            <Tooltip.Content>
              <p>{acConfigured ? "Traer los leads de la semana desde ActiveCampaign" : "Integración pendiente de conectar"}</p>
            </Tooltip.Content>
          </Tooltip>
          <Button variant="outline" onPress={() => setPanel(panel === "import" ? null : "import")}>
            ⇪ Importar consumo (CSV)
          </Button>
          <Button variant="primary" onPress={() => setPanel(panel === "add" ? null : "add")}>
            + Carrera
          </Button>
        </div>
      </div>

      {syncResult && (
        <div className={`rounded-lg px-3 py-2 text-sm ${syncResult.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`}>
          {syncResult.message}
          <Button size="sm" variant="ghost" className="ml-3" onPress={() => setSyncResult(null)}>
            Cerrar
          </Button>
        </div>
      )}

      {panel === "import" && (
        <BudgetImporter careers={careers} aliases={aliases} week={week} onClose={() => setPanel(null)} />
      )}

      {panel === "add" && (
        <form
          action={async (fd) => {
            await createCareerAction(fd);
            setPanel(null);
            router.refresh();
          }}
          className="card card--default grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6"
        >
          <Input fullWidth name="program" list="new-career-programs" required placeholder="Programa (ej. FISICC)" />
          <datalist id="new-career-programs">
            {programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <Input fullWidth name="code" placeholder="Código" />
          <Input fullWidth name="name" required className="sm:col-span-2" placeholder="Nombre de la carrera" />
          <AppSelect fullWidth name="level" defaultValue="Pregrado">
            {CAREER_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </AppSelect>
          <AppSelect fullWidth name="ownerId" defaultValue="none">
            <option value="none">Sin responsable</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </AppSelect>
          <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
            <Button variant="primary" type="submit">
              Agregar carrera
            </Button>
            <Button variant="outline" type="button" onPress={() => setPanel(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
