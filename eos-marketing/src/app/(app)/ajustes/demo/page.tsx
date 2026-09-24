import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { getDemoTeamFor } from "@/lib/domain/demo";
import { SettingsHeader } from "../settings-header";
import { DemoControls } from "./demo-controls";

export default async function DemoPage() {
  const session = await getSession();
  if (!session) return null;
  const [team, demo] = await Promise.all([getTeam(session.teamId), getDemoTeamFor(session.userId)]);
  const inDemo = Boolean(team?.is_demo);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsHeader
        title="Información demo"
        description="Muestra la plataforma llena de datos de ejemplo para presentaciones, sin tocar tu información real."
      />

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className={`badge ${inDemo ? "bg-yellow-bg text-yellow" : demo ? "bg-primary/10 text-primary" : "bg-background text-muted"}`}>
            {inDemo ? "Estás viendo la demo" : demo ? "Demo creada (no la estás viendo)" : "Demo desactivada"}
          </span>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            Se crea un equipo aparte, <b>{demo?.name ?? "“… · DEMO”"}</b>, con 12 semanas de leads y consumo,
            metas mensuales, Scorecard, Rocks, Issues, To-Dos, reuniones con noticias, V/TO,
            organigrama y el tablero de Control de carrera.
          </li>
          <li>Tu información real no se modifica. Lo que hagas dentro de la demo se queda en la demo.</li>
          <li>Solo tú ves la demo; el resto del equipo sigue viendo la información real.</li>
          <li>Al desactivarla, la demo y todos sus datos se borran y vuelves a tu equipo real.</li>
        </ul>
        <DemoControls inDemo={inDemo} hasDemo={Boolean(demo)} canEdit={session.role === "admin"} />
      </section>
    </div>
  );
}
