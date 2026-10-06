import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Button, Card, Chip, Input, TextField } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { listCampanasResumenAdmin } from "@/lib/domain/campanas";
import { CampanaCard } from "@/components/campana-card";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import {
  createCampanaAction,
  deleteCarreraAction,
  deleteFacultadAction,
  regenerarCodigoAction,
  renameCarreraAction,
} from "../../actions";
import { AjustesFacultadForm, CampanaForm, CrearCarreraForm } from "./facultad-forms";

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FacultadPage({ params }: PageProps<"/admin/facultades/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const facultadId = Number(id);
  const facultad = Number.isInteger(facultadId) ? await getFacultad(facultadId) : null;
  if (!facultad) notFound();

  const [carreras, campanas] = await Promise.all([listCarreras(facultad.id), listCampanasResumenAdmin(facultad.id)]);
  const enlace = `${await baseUrl()}/portal/ingresar?codigo=${facultad.codigo_acceso}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:underline">← Facultades</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{facultad.nombre}</h1>
          {!facultad.activa && <Chip variant="soft">Acceso inactivo</Chip>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Campañas ({campanas.filter((c) => c.id !== null).length})</h2>
            <p className="text-sm text-muted">Entra a una campaña para ver y agregar sus artes.</p>
          </div>
          {campanas.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              Esta facultad aún no tiene campañas. Crea la primera para empezar a cargar artes.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {campanas.map((c) => (
                <CampanaCard
                  key={c.id ?? "otros"}
                  campana={c}
                  href={`/admin/facultades/${facultad.id}/campanas/${c.id ?? "otros"}`}
                />
              ))}
            </div>
          )}
          <Card>
            <Card.Header>
              <Card.Title>Nueva campaña</Card.Title>
            </Card.Header>
            <Card.Content>
              <CampanaForm action={createCampanaAction.bind(null, facultad.id)} submitLabel="Crear campaña" />
            </Card.Content>
          </Card>
        </section>

        <aside className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Acceso al portal</Card.Title>
              <Card.Description>
                Comparte el enlace o el código con la facultad. Al entrar solo se pide nombre y correo.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-secondary p-3">
                <code className="font-mono text-lg font-bold tracking-wider">{facultad.codigo_acceso}</code>
                <CopyButton text={facultad.codigo_acceso} />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={enlace} label="Copiar enlace directo" />
                <form action={regenerarCodigoAction.bind(null, facultad.id)}>
                  <ConfirmButton
                    size="sm"
                    variant="tertiary"
                    title="¿Regenerar el código?"
                    message="Se generará un código nuevo y quienes estén dentro del portal con el código anterior perderán el acceso."
                    confirmLabel="Regenerar"
                  >
                    Regenerar código
                  </ConfirmButton>
                </form>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Carreras</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <CrearCarreraForm facultadId={facultad.id} />
              {carreras.length === 0 ? (
                <p className="text-sm text-muted">Sin carreras todavía.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {carreras.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <form action={renameCarreraAction.bind(null, c.id)} className="flex flex-1 gap-2">
                        <TextField name="nombre" defaultValue={c.nombre} isRequired aria-label="Nombre de la carrera" className="flex-1">
                          <Input />
                        </TextField>
                        <Button type="submit" size="sm" variant="tertiary" isIconOnly aria-label={`Guardar nombre de ${c.nombre}`}>
                          ✓
                        </Button>
                      </form>
                      <form action={deleteCarreraAction.bind(null, c.id)}>
                        <ConfirmButton
                          size="sm"
                          ariaLabel={`Eliminar ${c.nombre}`}
                          title={`¿Eliminar “${c.nombre}”?`}
                          message="Sus artes quedarán como “Toda la facultad”."
                          confirmLabel="Eliminar"
                        >
                          ✕
                        </ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Ajustes</Card.Title>
            </Card.Header>
            <Card.Content>
              <AjustesFacultadForm id={facultad.id} nombre={facultad.nombre} activa={facultad.activa} />
            </Card.Content>
            <Card.Footer className="border-t border-separator pt-4">
              <form action={deleteFacultadAction.bind(null, facultad.id)}>
                <ConfirmButton
                  title={`¿Eliminar “${facultad.nombre}”?`}
                  message="Se borrarán todas sus carreras, artes e historial. No se puede deshacer."
                  confirmLabel="Eliminar facultad"
                >
                  Eliminar facultad
                </ConfirmButton>
              </form>
            </Card.Footer>
          </Card>
        </aside>
      </div>
    </div>
  );
}
