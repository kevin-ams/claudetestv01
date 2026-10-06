import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { createArteAction } from "../../../actions";
import { ArteForm } from "../../../arte-form";

export default async function NuevoArtePage({ params }: PageProps<"/admin/facultades/[id]/nuevo-arte">) {
  await requireAdmin();
  const { id } = await params;
  const facultadId = Number(id);
  const facultad = Number.isInteger(facultadId) ? await getFacultad(facultadId) : null;
  if (!facultad) notFound();
  const carreras = await listCarreras(facultad.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <Link href={`/admin/facultades/${facultad.id}`} className="text-sm text-muted hover:underline">
          ← {facultad.nombre}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo arte para aprobación</h1>
      </div>
      <div className="card p-6">
        <ArteForm action={createArteAction.bind(null, facultad.id)} carreras={carreras} submitLabel="Crear arte" />
      </div>
    </div>
  );
}
