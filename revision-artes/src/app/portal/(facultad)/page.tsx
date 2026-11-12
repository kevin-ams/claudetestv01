import { Card } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { listCampanasResumen } from "@/lib/domain/campanas";
import { listCarreras } from "@/lib/domain/carreras";
import { CampanaCard } from "@/components/campana-card";
import { FiltroCarrera, filtrarCampanas } from "@/components/filtro-carrera";
import { GrupoAprobados, campanaAprobada } from "@/components/grupo-aprobados";
import { Guia } from "@/components/guia/guia";
import { pasosInicio } from "@/components/guia/pasos";

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const { session, facultad } = await requirePortal();
  const [campanas, carreras] = await Promise.all([listCampanasResumen(facultad.id), listCarreras(facultad.id)]);
  const { carrera } = await searchParams;
  const filtro = typeof carrera === "string" ? carrera : undefined;
  const visibles = filtrarCampanas(campanas, filtro);
  // Las campañas ya aprobadas se agrupan abajo, fuera de la vista principal.
  const activas = visibles.filter((c) => !campanaAprobada(c));
  const aprobadas = visibles.filter((c) => campanaAprobada(c));
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
      <FiltroCarrera base="/portal" actual={filtro} carreras={carreras} campanas={campanas} />
      {campanas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Aún no hay campañas cargadas para tu facultad.</Card>
      ) : visibles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">No hay campañas de esta carrera.</Card>
      ) : (
        <>
          {activas.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-guia="campanas">
              {activas.map((c) => (
                <CampanaCard key={c.id ?? "otros"} campana={c} href={`/portal/campanas/${c.id ?? "otros"}`} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted" data-guia="campanas">
              🎉 Todas las campañas están aprobadas.
            </Card>
          )}
          <GrupoAprobados titulo="Campañas aprobadas" cantidad={aprobadas.length}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aprobadas.map((c) => (
                <CampanaCard key={c.id ?? "otros"} campana={c} href={`/portal/campanas/${c.id ?? "otros"}`} />
              ))}
            </div>
          </GrupoAprobados>
        </>
      )}
      <Guia id="inicio" email={session.email} pasos={pasosInicio(session.name, facultad.nombre)} />
    </div>
  );
}
