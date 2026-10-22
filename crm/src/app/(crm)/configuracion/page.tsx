import { getSession } from "@/lib/auth/session";
import { defaultPipelineId, listStages } from "@/lib/domain/pipeline";
import { StageEditor } from "./stage-editor";

export default async function SettingsPage() {
  const session = await getSession();
  const stages = await listStages(await defaultPipelineId());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted">Ajustes generales del CRM</p>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Etapas del pipeline</h2>
        <p className="mt-1 text-sm text-muted">
          Reordena, renombra, agrega o quita etapas. La probabilidad alimenta el pronóstico ponderado.
          Siempre debe existir al menos una etapa de ganado y una de perdido.
        </p>
        <StageEditor stages={stages} canEdit={session?.role === "admin"} />
      </section>
    </div>
  );
}
