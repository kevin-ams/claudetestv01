import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getArte, listRevisiones } from "@/lib/domain/artes";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { ConfirmButton } from "@/components/confirm-button";
import { DrivePreview } from "@/components/drive-preview";
import { EstadoBadge } from "@/components/estado-badge";
import { Historial } from "@/components/historial";
import { deleteArteAction, updateArteAction } from "../../actions";
import { ArteForm } from "../../arte-form";
import { ComentarioForm } from "./comentario-form";

export default async function AdminArtePage({ params }: PageProps<"/admin/artes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const arteId = Number(id);
  const arte = Number.isInteger(arteId) ? await getArte(arteId) : null;
  if (!arte) notFound();

  const [facultad, carreras, revisiones] = await Promise.all([
    getFacultad(arte.facultad_id),
    listCarreras(arte.facultad_id),
    listRevisiones(arte.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/facultades/${arte.facultad_id}`} className="text-sm text-muted hover:underline">
          ← {facultad?.nombre}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{arte.titulo}</h1>
          <EstadoBadge estado={arte.estado} />
          <span className="text-sm text-muted">Versión {arte.version}</span>
        </div>
        <p className="text-sm text-muted">{arte.carrera_nombre ?? "Toda la facultad"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <DrivePreview url={arte.drive_url} title={arte.titulo} />
          <section className="card p-6">
            <h2 className="mb-4 text-lg font-semibold">Editar arte</h2>
            <ArteForm action={updateArteAction.bind(null, arte.id)} carreras={carreras} valores={arte} submitLabel="Guardar cambios" />
            <form action={deleteArteAction.bind(null, arte.id)} className="mt-6 border-t border-border pt-4">
              <ConfirmButton message="¿Eliminar este arte y su historial? El archivo en Drive no se borra.">
                Eliminar arte
              </ConfirmButton>
            </form>
          </section>
        </div>
        <aside className="card flex h-fit flex-col gap-4 p-4">
          <h2 className="font-semibold">Historial de revisión</h2>
          <ComentarioForm arteId={arte.id} />
          <Historial revisiones={revisiones} showEmail />
        </aside>
      </div>
    </div>
  );
}
