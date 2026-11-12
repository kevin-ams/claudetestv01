import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip } from "@heroui/react";
import { GrupoAprobados } from "@/components/grupo-aprobados";
import { requirePortal } from "@/lib/auth/session";
import { getCampanaPortal } from "@/lib/domain/campanas";
import { listArtes } from "@/lib/domain/artes";
import { ArteCard } from "@/components/arte-card";
import { FiltrosArtes, filtrarArtes } from "@/components/filtros-artes";
import { Guia } from "@/components/guia/guia";
import { pasosCampana } from "@/components/guia/pasos";

export default async function PortalCampanaPage({ params, searchParams }: PageProps<"/portal/campanas/[cid]">) {
  const { session, facultad } = await requirePortal();
  const { cid } = await params;
  const { estado } = await searchParams;

  // Solo campañas de su facultad (otra responde 404) y sin datos internos.
  const campana = cid === "otros" ? null : await getCampanaPortal(Number(cid), facultad.id);
  if (cid !== "otros" && !campana) notFound();

  const todos = await listArtes(facultad.id);
  const artes = todos.filter((a) => a.campana_id === (campana?.id ?? null));
  if (cid === "otros" && artes.length === 0) notFound();
  // La carrera es de la campaña: dentro de ella solo se filtra por estado.
  const filtros = { estado: typeof estado === "string" ? estado : undefined };
  const visibles = filtrarArtes(artes, filtros);
  // Sin filtro, los aprobados se agrupan abajo en un acordeón.
  const principales = filtros.estado ? visibles : visibles.filter((a) => a.estado !== "aprobado");
  const aprobados = filtros.estado ? [] : visibles.filter((a) => a.estado === "aprobado");
  const pendientes = artes.filter((a) => a.estado === "pendiente").length;

  return (
    <div className="flex flex-col gap-4">
      <div data-guia="migas">
        <Link href="/portal" className="text-sm text-muted hover:underline">← Campañas</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{campana?.nombre ?? "Otros artes"}</h1>
          {campana && (
            <Chip size="sm" variant="soft" color="accent">
              {campana.carrera_nombre ?? "Toda la facultad"}
            </Chip>
          )}
        </div>
        {campana?.descripcion && <p className="text-sm text-muted">{campana.descripcion}</p>}
        <p className="mt-1 text-sm text-muted">
          {pendientes === 0
            ? "No hay artes pendientes en esta campaña."
            : `${pendientes} ${pendientes === 1 ? "arte pendiente" : "artes pendientes"} de tu revisión.`}
        </p>
      </div>
      <div data-guia="filtros">
        <FiltrosArtes base={`/portal/campanas/${cid}`} filtros={filtros} carreras={[]} artes={artes} />
      </div>
      {visibles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          {artes.length === 0 ? "Esta campaña aún no tiene artes." : "No hay artes con estos filtros."}
        </Card>
      ) : (
        <>
          {principales.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {principales.map((a, i) => (
                <ArteCard key={a.id} arte={a} href={`/portal/artes/${a.id}`} data-guia={i === 0 ? "arte" : undefined} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted">🎉 Todos los artes de esta campaña están aprobados.</Card>
          )}
          <GrupoAprobados titulo="Artes aprobados" cantidad={aprobados.length}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {aprobados.map((a) => (
                <ArteCard key={a.id} arte={a} href={`/portal/artes/${a.id}`} />
              ))}
            </div>
          </GrupoAprobados>
        </>
      )}
      <Guia id="campana" email={session.email} pasos={pasosCampana} />
    </div>
  );
}
