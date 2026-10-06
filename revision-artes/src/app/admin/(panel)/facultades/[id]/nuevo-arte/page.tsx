import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { listCampanas } from "@/lib/domain/campanas";
import { createArteAction } from "../../../actions";
import { ArteForm } from "../../../arte-form";

export default async function NuevoArtePage({
  params,
  searchParams,
}: PageProps<"/admin/facultades/[id]/nuevo-arte">) {
  await requireAdmin();
  const { id } = await params;
  const facultadId = Number(id);
  const facultad = Number.isInteger(facultadId) ? await getFacultad(facultadId) : null;
  if (!facultad) notFound();
  const { campana } = await searchParams;
  const [carreras, campanas] = await Promise.all([listCarreras(facultad.id), listCampanas(facultad.id)]);
  const inicial = campanas.find((c) => String(c.id) === campana) ?? null;
  const volver = inicial ? `/admin/facultades/${facultad.id}/campanas/${inicial.id}` : `/admin/facultades/${facultad.id}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <Link href={volver} className="text-sm text-muted hover:underline">
          ← {facultad.nombre}
          {inicial && ` › ${inicial.nombre}`}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo arte para aprobación</h1>
      </div>
      <Card className="p-6">
        <ArteForm action={createArteAction.bind(null, facultad.id)} carreras={carreras} campanas={campanas} campanaInicial={inicial?.id ?? null} conEnlace submitLabel="Crear arte" />
      </Card>
    </div>
  );
}
