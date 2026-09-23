import { getSession } from "@/lib/auth/session";
import { countCompletions, listControlMilestones } from "@/lib/domain/control-milestones";
import { MilestoneSettings } from "./milestone-settings";

export default async function AjustesPage() {
  const session = await getSession();
  if (!session) return null;

  const milestones = await listControlMilestones(session.teamId);
  const completions = Object.fromEntries(
    await Promise.all(milestones.map(async (m) => [m.key, await countCompletions(session.teamId, m.key)] as const))
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted">Configuración del sistema para tu equipo.</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">Hitos de Control de carrera</h2>
          <p className="text-sm text-muted">
            Edita, renombra, elimina, agrega o reordena los hitos, y cambia su duración y de qué hitos
            dependen. La ruta crítica y las fechas del tablero se recalculan con estos datos.
          </p>
        </div>
        <MilestoneSettings
          milestones={milestones}
          completions={completions}
          canEdit={session.role === "admin"}
        />
      </section>
    </div>
  );
}
