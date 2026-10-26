import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listArchivedMetrics } from "@/lib/domain/scorecard";
import { SettingsHeader } from "../settings-header";
import { ArchivedMetrics } from "./archived-metrics";

export default async function ArchivedMetricsPage() {
  const session = await getSession();
  if (!session) return null;
  const [metrics, editable] = await Promise.all([listArchivedMetrics(session.teamId), canEdit("scorecard")]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsHeader
        title="Indicadores archivados"
        description="Indicadores del Scorecard que se archivaron. Sus datos y metas se conservan: al restaurarlos vuelven al final de la lista."
      />
      <ArchivedMetrics
        metrics={metrics.map((m) => ({ id: m.id, name: m.name, predicts: m.predicts, archived_at: m.archived_at ?? null }))}
        editable={editable}
      />
    </div>
  );
}
