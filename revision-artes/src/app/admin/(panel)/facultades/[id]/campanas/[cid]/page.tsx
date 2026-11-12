import { FileText, Layers } from "@gravity-ui/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, Chip } from "@heroui/react";
import { GrupoAprobados } from "@/components/grupo-aprobados";
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
  const { estado, lote } = await searchParams;
  const facultad = Number.isInteger(Number(id)) ? await getFacultad(Number(id)) : null;
  if (!facultad) notFound();

  // "otros" = artes sin campaña.
  const campana = cid === "otros" ? null : await getCampana(Number(cid), facultad.id);
  if (cid !== "otros" && !campana) notFound();

  const [carreras, todos] = await Promise.all([listCarreras(facultad.id), listArtes(facultad.id)]);
  const artes = todos.filter((a) => a.campana_id === (campana?.id ?? null));
  // La carrera es de la campaña: dentro de ella solo se filtra por estado.
  const filtros = { estado: typeof estado === "string" ? estado : undefined };
  const visibles = filtrarArtes(artes, filtros);
  // Sin filtro, lo aprobado se agrupa abajo en un acordeón.
  const principales = filtros.estado ? visibles : visibles.filter((a) => a.estado !== "aprobado");
  const aprobados = filtros.estado ? [] : visibles.filter((a) => a.estado === "aprobado");
  const base = `/admin/facultades/${facultad.id}/campanas/${cid}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/facultades/${facultad.id}`} className="text-sm text-muted hover:underline">
          ← {facultad.nombre}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{campana?.nombre ?? "Otros artes"}</h1>
          {campana && (
            <Chip size="sm" variant="soft" color="accent">
              {campana.carrera_nombre ?? "Toda la facultad"}
            </Chip>
          )}
        </div>
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

      {typeof lote === "string" && lote && (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{lote}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Artes ({artes.length})</h2>
            <div className="flex flex-wrap gap-2">
              {campana && (
                <Link href={`${base}/lote`} className={buttonVariants({ variant: "secondary" })}>
                  <Layers aria-hidden className="size-4" />
                  Subir en lote
                </Link>
              )}
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
          <FiltrosArtes base={base} filtros={filtros} carreras={[]} artes={artes} />
          {visibles.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              {artes.length === 0 ? "Esta campaña aún no tiene artes." : "No hay artes con estos filtros."}
            </Card>
          ) : (
            <>
              {principales.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {principales.map((a) => (
                    <ArteCard key={a.id} arte={a} href={`/admin/artes/${a.id}`} />
                  ))}
                </div>
              )}
              <GrupoAprobados titulo="Artes aprobados" cantidad={aprobados.length}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {aprobados.map((a) => (
                    <ArteCard key={a.id} arte={a} href={`/admin/artes/${a.id}`} />
                  ))}
                </div>
              </GrupoAprobados>
            </>
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
                  carreras={carreras}
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
