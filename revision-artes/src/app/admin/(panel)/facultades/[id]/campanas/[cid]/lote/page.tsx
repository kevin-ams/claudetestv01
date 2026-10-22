import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { getCampana } from "@/lib/domain/campanas";
import { listCarreras } from "@/lib/domain/carreras";
import { listArtes, listRevisoresFacultad } from "@/lib/domain/artes";
import { emailConfigured } from "@/lib/email";
import { parseDriveUrl } from "@/lib/drive";
import { LoteForm } from "./lote-form";

export default async function LotePage({ params }: PageProps<"/admin/facultades/[id]/campanas/[cid]/lote">) {
  await requireAdmin();
  const { id, cid } = await params;
  const facultad = await getFacultad(Number(id));
  const campana = facultad ? await getCampana(Number(cid), facultad.id) : null;
  if (!facultad || !campana) notFound();

  const [carreras, artes, revisores] = await Promise.all([
    listCarreras(facultad.id),
    listArtes(facultad.id),
    listRevisoresFacultad(facultad.id),
  ]);
  const existentes = artes
    .filter((a) => a.campana_id === campana.id)
    .map((a) => parseDriveUrl(a.drive_url)?.id)
    .filter((x): x is string => Boolean(x));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/admin/facultades/${facultad.id}`} className="hover:underline">
            {facultad.nombre}
          </Link>
          {" › "}
          <Link href={`/admin/facultades/${facultad.id}/campanas/${campana.id}`} className="hover:underline">
            {campana.nombre}
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">Subir artes en lote</h1>
        <p className="text-sm text-muted">
          Pega varios enlaces de Drive, completa los datos en la tabla y crea todos los artes de una vez.
        </p>
      </div>
      <LoteForm
        facultadId={facultad.id}
        campanaId={campana.id}
        campanaNombre={campana.nombre}
        carreras={carreras.map((c) => ({ id: c.id, nombre: c.nombre }))}
        existentes={existentes}
        correosSugeridos={revisores.map((r) => r.email)}
        correoConfigurado={emailConfigured()}
      />
    </div>
  );
}
