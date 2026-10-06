import { Card } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { listArtes } from "@/lib/domain/artes";
import { listCarreras } from "@/lib/domain/carreras";
import { ArteCard } from "@/components/arte-card";
import { FiltrosArtes, filtrarArtes } from "@/components/filtros-artes";

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const { facultad } = await requirePortal();
  const { carrera, estado } = await searchParams;
  const [carreras, artes] = await Promise.all([listCarreras(facultad.id), listArtes(facultad.id)]);
  const filtros = {
    carrera: typeof carrera === "string" ? carrera : undefined,
    estado: typeof estado === "string" ? estado : undefined,
  };
  const visibles = filtrarArtes(artes, filtros);
  const pendientes = artes.filter((a) => a.estado === "pendiente").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Artes para revisión</h1>
        <p className="text-sm text-muted">
          {pendientes === 0
            ? "No tienes artes pendientes de revisión."
            : `Tienes ${pendientes} ${pendientes === 1 ? "arte pendiente" : "artes pendientes"} de revisión.`}
        </p>
      </div>
      <FiltrosArtes base="/portal" filtros={filtros} carreras={carreras} artes={artes} />
      {visibles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          {artes.length === 0 ? "Aún no hay artes cargados para tu facultad." : "No hay artes con estos filtros."}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((a) => (
            <ArteCard key={a.id} arte={a} href={`/portal/artes/${a.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
