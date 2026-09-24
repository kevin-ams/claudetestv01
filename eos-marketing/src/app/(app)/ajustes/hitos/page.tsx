import { getSession } from "@/lib/auth/session";
import { countCompletions, listControlMilestones } from "@/lib/domain/control-milestones";
import { MilestoneSettings } from "./milestone-settings";
import { SettingsHeader } from "../settings-header";

export default async function AjustesPage() {
  const session = await getSession();
  if (!session) return null;

  const milestones = await listControlMilestones(session.teamId);
  const completions = Object.fromEntries(
    await Promise.all(milestones.map(async (m) => [m.key, await countCompletions(session.teamId, m.key)] as const))
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Hitos de Control de carrera"
        description="Edita, renombra, elimina, agrega o reordena los hitos, y cambia su duración y de qué hitos dependen. La ruta crítica y las fechas del tablero se recalculan con estos datos."
      />

      <section className="flex flex-col gap-3">
        <MilestoneSettings
          milestones={milestones}
          completions={completions}
          canEdit={session.role === "admin"}
        />
      </section>
    </div>
  );
}
