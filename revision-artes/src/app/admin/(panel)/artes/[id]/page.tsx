import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { getArte, listAnotaciones, listRevisiones, listVersiones } from "@/lib/domain/artes";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { ConfirmButton } from "@/components/confirm-button";
import { EstadoBadge } from "@/components/estado-badge";
import { Historial } from "@/components/historial";
import { VersionSelector } from "@/components/version-selector";
import { VisorConPuntos } from "@/components/visor-con-puntos";
import { deleteArteAction, updateArteAction } from "../../actions";
import { ArteForm } from "../../arte-form";
import { ComentarioForm } from "./comentario-form";
import { NuevaVersionForm } from "./nueva-version-form";

export default async function AdminArtePage({ params, searchParams }: PageProps<"/admin/artes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { v } = await searchParams;
  const arteId = Number(id);
  const arte = Number.isInteger(arteId) ? await getArte(arteId) : null;
  if (!arte) notFound();

  const [facultad, carreras, revisiones, versiones, anotaciones] = await Promise.all([
    getFacultad(arte.facultad_id),
    listCarreras(arte.facultad_id),
    listRevisiones(arte.id),
    listVersiones(arte.id),
    listAnotaciones(arte.id),
  ]);

  const vista = versiones.find((x) => String(x.version) === v) ?? versiones.find((x) => x.version === arte.version);
  const urlVista = vista?.drive_url ?? arte.drive_url;
  const versionVista = vista?.version ?? arte.version;

  // Lo que la facultad pidió sobre la versión actual y sigue abierto.
  const pendientes = anotaciones
    .filter((a) => a.version === arte.version && !a.atendida)
    .map((a) => ({ id: a.id, numero: a.numero, comentario: a.comentario, autor: a.autor_nombre }));
  const solicitudes = revisiones
    .filter((r) => r.version === arte.version && r.accion === "cambios" && r.comentario)
    .map((r) => ({ id: r.id, autor: r.autor_nombre, comentario: r.comentario }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/facultades/${arte.facultad_id}`} className="text-sm text-muted hover:underline">
          ← {facultad?.nombre}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{arte.titulo}</h1>
          <EstadoBadge estado={arte.estado} size="md" />
          <span className="text-sm text-muted">Versión {arte.version}</span>
        </div>
        <p className="text-sm text-muted">{arte.carrera_nombre ?? "Toda la facultad"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Card>
            <Card.Content className="flex flex-col gap-3">
              <VersionSelector
                base={`/admin/artes/${arte.id}`}
                versiones={versiones}
                vista={versionVista}
                actual={arte.version}
              />
              {vista?.nota && (
                <p className="rounded-xl bg-accent-soft p-3 text-sm">
                  <span className="font-semibold">Cambios en v{vista.version}:</span> {vista.nota}
                </p>
              )}
              <VisorConPuntos
                key={versionVista}
                driveUrl={urlVista}
                title={arte.titulo}
                anotaciones={anotaciones.filter((a) => a.version === versionVista)}
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Datos del arte</Card.Title>
            </Card.Header>
            <Card.Content>
              <ArteForm
                action={updateArteAction.bind(null, arte.id)}
                carreras={carreras}
                valores={arte}
                conEnlace={false}
                submitLabel="Guardar cambios"
              />
            </Card.Content>
            <Card.Footer className="border-t border-separator pt-4">
              <form action={deleteArteAction.bind(null, arte.id)}>
                <ConfirmButton
                  title="¿Eliminar este arte?"
                  message="Se borrará el arte con todo su historial y puntos. El archivo en Drive no se borra."
                  confirmLabel="Eliminar arte"
                >
                  Eliminar arte
                </ConfirmButton>
              </form>
            </Card.Footer>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card id="nueva-version">
            <Card.Header>
              <Card.Title>Subir nueva versión</Card.Title>
              <Card.Description>Con los cambios solicitados por la facultad.</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              {arte.estado === "cambios" && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>La facultad solicitó cambios</Alert.Title>
                    <Alert.Description>Corrige el arte y publica la nueva versión para que lo vuelvan a revisar.</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <NuevaVersionForm
                key={arte.version}
                arteId={arte.id}
                versionActual={arte.version}
                puntos={pendientes}
                solicitudes={solicitudes}
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Historial de revisión</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              <ComentarioForm arteId={arte.id} />
              <Historial revisiones={revisiones} anotaciones={anotaciones} showEmail />
            </Card.Content>
          </Card>
        </aside>
      </div>
    </div>
  );
}
