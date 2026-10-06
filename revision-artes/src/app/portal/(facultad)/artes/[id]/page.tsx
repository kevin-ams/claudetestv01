import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { getArte, listAnotaciones, listRevisiones, listVersiones, type Arte } from "@/lib/domain/artes";
import { formatFecha } from "@/lib/format";
import { EstadoBadge } from "@/components/estado-badge";
import { Historial } from "@/components/historial";
import { VersionSelector } from "@/components/version-selector";
import { VisorConPuntos } from "@/components/visor-con-puntos";
import { RevisionArte } from "./revision-arte";

function Detalles({ arte }: { arte: Arte }) {
  return (
    <Card>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
    </Card>
  );
}

export default async function PortalArtePage({ params, searchParams }: PageProps<"/portal/artes/[id]">) {
  const { facultad } = await requirePortal();
  const { id } = await params;
  const { v } = await searchParams;
  const arteId = Number(id);
  // getArte con facultadId: un arte de otra facultad responde 404.
  const arte = Number.isInteger(arteId) ? await getArte(arteId, facultad.id) : null;
  if (!arte) notFound();
  const [revisiones, versiones, anotaciones] = await Promise.all([
    listRevisiones(arte.id),
    listVersiones(arte.id),
    listAnotaciones(arte.id),
  ]);

  const anterior = versiones.find((x) => String(x.version) === v && x.version !== arte.version);
  const versionVista = anterior?.version ?? arte.version;
  const notaActual = versiones.find((x) => x.version === arte.version)?.nota;

  const historial = (
    <Card>
      <Card.Header>
        <Card.Title>Historial</Card.Title>
      </Card.Header>
      <Card.Content>
        <Historial revisiones={revisiones} anotaciones={anotaciones} showEmail={false} ocultar={["notificacion"]} />
      </Card.Content>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/portal" className="text-sm text-muted hover:underline">← Todos los artes</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{arte.titulo}</h1>
          <EstadoBadge estado={arte.estado} size="md" />
          <span className="text-sm text-muted">Versión {arte.version}</span>
        </div>
        <VersionSelector base={`/portal/artes/${arte.id}`} versiones={versiones} vista={versionVista} actual={arte.version} />
      </div>

      {anterior ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-4">
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  Estás viendo la v{anterior.version}, una versión anterior.{" "}
                  <Link href={`/portal/artes/${arte.id}`} className="font-semibold underline">
                    Ir a la versión actual para revisar
                  </Link>
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <Card>
              <Card.Content>
                <VisorConPuntos
                  driveUrl={anterior.drive_url}
                  title={arte.titulo}
                  anotaciones={anotaciones.filter((a) => a.version === anterior.version)}
                />
              </Card.Content>
            </Card>
          </div>
          <aside>{historial}</aside>
        </div>
      ) : (
        <>
          {notaActual && arte.version > 1 && (
            <Alert status="accent">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Novedades de la v{arte.version}</Alert.Title>
                <Alert.Description>{notaActual}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <RevisionArte
            key={arte.version}
            arteId={arte.id}
            version={arte.version}
            driveUrl={arte.drive_url}
            titulo={arte.titulo}
            guardadas={anotaciones.filter((a) => a.version === arte.version)}
            detalles={<Detalles arte={arte} />}
            historial={historial}
          />
        </>
      )}
    </div>
  );
}
