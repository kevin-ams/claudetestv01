import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { getCampana } from "@/lib/domain/campanas";
import { listCarreras } from "@/lib/domain/carreras";
import { listArtes } from "@/lib/domain/artes";
import { ArteCard } from "@/components/arte-card";
import { FiltrosArtes, filtrarArtes } from "@/components/filtros-artes";
import { Guia } from "@/components/guia/guia";
import { pasosCampana } from "@/components/guia/pasos";

export default async function PortalCampanaPage({ params, searchParams }: PageProps<"/portal/campanas/[cid]">) {
  const { session, facultad } = await requirePortal();
  const { cid } = await params;
  const { carrera, estado } = await searchParams;

  // getCampana con facultadId: una campaña de otra facultad responde 404.
  const campana = cid === "otros" ? null : await getCampana(Number(cid), facultad.id);
  if (cid !== "otros" && !campana) notFound();

  const [carreras, todos] = await Promise.all([listCarreras(facultad.id), listArtes(facultad.id)]);
  const artes = todos.filter((a) => a.campana_id === (campana?.id ?? null));
  if (cid === "otros" && artes.length === 0) notFound();
  const filtros = {
    carrera: typeof carrera === "string" ? carrera : undefined,
    estado: typeof estado === "string" ? estado : undefined,
  };
  const visibles = filtrarArtes(artes, filtros);
  const pendientes = artes.filter((a) => a.estado === "pendiente").length;

  return (
    <div className="flex flex-col gap-4">
      <div data-guia="migas">
        <Link href="/portal" className="text-sm text-muted hover:underline">← Campañas</Link>
        <h1 className="mt-1 text-2xl font-bold">{campana?.nombre ?? "Otros artes"}</h1>
        {campana?.descripcion && <p className="text-sm text-muted">{campana.descripcion}</p>}
        <p className="mt-1 text-sm text-muted">
          {pendientes === 0
            ? "No hay artes pendientes en esta campaña."
            : `${pendientes} ${pendientes === 1 ? "arte pendiente" : "artes pendientes"} de tu revisión.`}
        </p>
      </div>
      <div data-guia="filtros">
        <FiltrosArtes base={`/portal/campanas/${cid}`} filtros={filtros} carreras={carreras} artes={artes} />
      </div>
      {visibles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          {artes.length === 0 ? "Esta campaña aún no tiene artes." : "No hay artes con estos filtros."}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((a, i) => (
            <ArteCard key={a.id} arte={a} href={`/portal/artes/${a.id}`} data-guia={i === 0 ? "arte" : undefined} />
          ))}
        </div>
      )}
      <Guia id="campana" email={session.email} pasos={pasosCampana} />
    </div>
  );
}
