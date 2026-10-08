import { FileText } from "@gravity-ui/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { getCampana } from "@/lib/domain/campanas";
import { listCarreras } from "@/lib/domain/carreras";
import { listArtes } from "@/lib/domain/artes";
import { ArteCard } from "@/components/arte-card";
import { ConfirmButton } from "@/components/confirm-button";
import { FiltrosArtes, filtrarArtes } from "@/components/filtros-artes";
import { deleteCampanaAction, updateCampanaAction } from "../../../../actions";
import { CampanaForm } from "../../facultad-forms";

export default async function AdminCampanaPage({
  params,
  searchParams,
}: PageProps<"/admin/facultades/[id]/campanas/[cid]">) {
  await requireAdmin();
  const { id, cid } = await params;
  const { carrera, estado } = await searchParams;
  const facultad = Number.isInteger(Number(id)) ? await getFacultad(Number(id)) : null;
  if (!facultad) notFound();

  // "otros" = artes sin campaña.
  const campana = cid === "otros" ? null : await getCampana(Number(cid), facultad.id);
  if (cid !== "otros" && !campana) notFound();

  const [carreras, todos] = await Promise.all([listCarreras(facultad.id), listArtes(facultad.id)]);
  const artes = todos.filter((a) => a.campana_id === (campana?.id ?? null));
  const filtros = {
    carrera: typeof carrera === "string" ? carrera : undefined,
    estado: typeof estado === "string" ? estado : undefined,
  };
  const visibles = filtrarArtes(artes, filtros);
  const base = `/admin/facultades/${facultad.id}/campanas/${cid}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/facultades/${facultad.id}`} className="text-sm text-muted hover:underline">
          ← {facultad.nombre}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{campana?.nombre ?? "Otros artes"}</h1>
        {campana?.descripcion && <p className="text-sm text-muted">{campana.descripcion}</p>}
        {campana && (
          <p className="mt-1 text-xs text-muted">
            ✉️ Cuando la facultad termine de revisar todos los artes se avisará por correo a{" "}
            {campana.creado_por_email
              ? `${campana.creado_por_nombre} (${campana.creado_por_email}), quien creó la campaña`
              : "todos los administradores (la campaña no tiene creador registrado)"}
            .
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Artes ({artes.length})</h2>
            <div className="flex flex-wrap gap-2">
              {campana && (
                <Link href={`${base}/reporte`} className={buttonVariants({ variant: "secondary" })}>
                  <FileText aria-hidden className="size-4" />
                  Reporte para Diseño
                </Link>
              )}
              <Link
                href={`/admin/facultades/${facultad.id}/nuevo-arte${campana ? `?campana=${campana.id}` : ""}`}
                className={buttonVariants({ variant: "primary" })}
              >
                + Nuevo arte
              </Link>
            </div>
          </div>
          <FiltrosArtes base={base} filtros={filtros} carreras={carreras} artes={artes} />
          {visibles.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              {artes.length === 0 ? "Esta campaña aún no tiene artes." : "No hay artes con estos filtros."}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibles.map((a) => (
                <ArteCard key={a.id} arte={a} href={`/admin/artes/${a.id}`} />
              ))}
            </div>
          )}
        </section>

        {campana && (
          <aside>
            <Card>
              <Card.Header>
                <Card.Title>Datos de la campaña</Card.Title>
              </Card.Header>
              <Card.Content>
                <CampanaForm
                  action={updateCampanaAction.bind(null, campana.id)}
                  valores={campana}
                  submitLabel="Guardar"
                />
              </Card.Content>
              <Card.Footer className="border-t border-separator pt-4">
                <form action={deleteCampanaAction.bind(null, campana.id)}>
                  <ConfirmButton
                    title={`¿Eliminar “${campana.nombre}”?`}
                    message="Sus artes no se borran: pasan a “Otros artes”."
                    confirmLabel="Eliminar campaña"
                  >
                    Eliminar campaña
                  </ConfirmButton>
                </form>
              </Card.Footer>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
