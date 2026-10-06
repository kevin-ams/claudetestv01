import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortal } from "@/lib/auth/session";
import { getArte, listRevisiones } from "@/lib/domain/artes";
import { formatFecha } from "@/lib/format";
import { DrivePreview } from "@/components/drive-preview";
import { EstadoBadge } from "@/components/estado-badge";
import { Historial } from "@/components/historial";
import { RevisionForm } from "./revision-form";

export default async function PortalArtePage({ params }: PageProps<"/portal/artes/[id]">) {
  const { facultad } = await requirePortal();
  const { id } = await params;
  const arteId = Number(id);
  // getArte con facultadId: un arte de otra facultad responde 404.
  const arte = Number.isInteger(arteId) ? await getArte(arteId, facultad.id) : null;
  if (!arte) notFound();
  const revisiones = await listRevisiones(arte.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/portal" className="text-sm text-muted hover:underline">← Todos los artes</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{arte.titulo}</h1>
          <EstadoBadge estado={arte.estado} />
          <span className="text-sm text-muted">Versión {arte.version}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <DrivePreview url={arte.drive_url} title={arte.titulo} />
          <dl className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Carrera</dt>
              <dd>{arte.carrera_nombre ?? "Toda la facultad"}</dd>
            </div>
            {arte.campana && (
              <div>
                <dt className="text-xs text-muted">Campaña</dt>
                <dd>{arte.campana}</dd>
              </div>
            )}
            {arte.formato && (
              <div>
                <dt className="text-xs text-muted">Formato / canal</dt>
                <dd>{arte.formato}</dd>
              </div>
            )}
            {arte.fecha_publicacion && (
              <div>
                <dt className="text-xs text-muted">Fecha de publicación</dt>
                <dd>{formatFecha(arte.fecha_publicacion)}</dd>
              </div>
            )}
            {arte.descripcion && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Copy / indicaciones</dt>
                <dd className="whitespace-pre-wrap">{arte.descripcion}</dd>
              </div>
            )}
          </dl>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Tu revisión</h2>
            <RevisionForm arteId={arte.id} />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Historial</h2>
            <Historial revisiones={revisiones} showEmail={false} />
          </div>
        </aside>
      </div>
    </div>
  );
}
