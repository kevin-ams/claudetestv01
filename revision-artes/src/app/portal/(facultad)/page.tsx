import { Card } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { listCampanasResumen } from "@/lib/domain/campanas";
import { CampanaCard } from "@/components/campana-card";
import { Guia } from "@/components/guia/guia";
import { pasosInicio } from "@/components/guia/pasos";

export default async function PortalHome() {
  const { session, facultad } = await requirePortal();
  const campanas = await listCampanasResumen(facultad.id);
  const pendientes = campanas.reduce((n, c) => n + c.pendientes, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Campañas</h1>
        <p className="text-sm text-muted">
          {pendientes === 0
            ? "No tienes artes pendientes de revisión."
            : `Tienes ${pendientes} ${pendientes === 1 ? "arte pendiente" : "artes pendientes"} de revisión. Entra a una campaña para revisarlos.`}
        </p>
      </div>
      {campanas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Aún no hay campañas cargadas para tu facultad.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-guia="campanas">
          {campanas.map((c) => (
            <CampanaCard key={c.id ?? "otros"} campana={c} href={`/portal/campanas/${c.id ?? "otros"}`} />
          ))}
        </div>
      )}
      <Guia id="inicio" email={session.email} pasos={pasosInicio(session.name, facultad.nombre)} />
    </div>
  );
}
