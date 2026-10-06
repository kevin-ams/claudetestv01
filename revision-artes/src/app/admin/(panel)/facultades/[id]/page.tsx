import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getFacultad } from "@/lib/domain/facultades";
import { listCarreras } from "@/lib/domain/carreras";
import { listArtes } from "@/lib/domain/artes";
import { ArteCard } from "@/components/arte-card";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { FiltrosArtes, filtrarArtes } from "@/components/filtros-artes";
import {
  deleteCarreraAction,
  deleteFacultadAction,
  regenerarCodigoAction,
  renameCarreraAction,
} from "../../actions";
import { AjustesFacultadForm, CrearCarreraForm } from "./facultad-forms";

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FacultadPage({ params, searchParams }: PageProps<"/admin/facultades/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { carrera, estado } = await searchParams;
  const facultadId = Number(id);
  const facultad = Number.isInteger(facultadId) ? await getFacultad(facultadId) : null;
  if (!facultad) notFound();

  const [carreras, artes] = await Promise.all([listCarreras(facultad.id), listArtes(facultad.id)]);
  const filtros = {
    carrera: typeof carrera === "string" ? carrera : undefined,
    estado: typeof estado === "string" ? estado : undefined,
  };
  const visibles = filtrarArtes(artes, filtros);
  const enlace = `${await baseUrl()}/portal/ingresar?codigo=${facultad.codigo_acceso}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:underline">← Facultades</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{facultad.nombre}</h1>
          {!facultad.activa && <span className="badge bg-background text-muted">Acceso inactivo</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Artes ({artes.length})</h2>
            <Link href={`/admin/facultades/${facultad.id}/nuevo-arte`} className="btn btn-primary">
              + Nuevo arte
            </Link>
          </div>
          <FiltrosArtes base={`/admin/facultades/${facultad.id}`} filtros={filtros} carreras={carreras} artes={artes} />
          {visibles.length === 0 ? (
            <p className="card p-6 text-center text-sm text-muted">
              {artes.length === 0 ? "Esta facultad aún no tiene artes." : "No hay artes con estos filtros."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibles.map((a) => (
                <ArteCard key={a.id} arte={a} href={`/admin/artes/${a.id}`} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="font-semibold">Acceso al portal</h2>
            <p className="mt-1 text-xs text-muted">
              Comparte el enlace o el código con la facultad. Al entrar solo se pide nombre y correo.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-background p-3">
              <code className="font-mono text-lg font-bold tracking-wider">{facultad.codigo_acceso}</code>
              <CopyButton text={facultad.codigo_acceso} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton text={enlace} label="Copiar enlace directo" />
              <form action={regenerarCodigoAction.bind(null, facultad.id)}>
                <ConfirmButton
                  className="btn btn-secondary !px-3 !py-1.5 text-xs"
                  message="Se generará un código nuevo y quienes estén dentro del portal con el código anterior perderán el acceso. ¿Continuar?"
                >
                  Regenerar código
                </ConfirmButton>
              </form>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold">Carreras</h2>
            <div className="mt-3">
              <CrearCarreraForm facultadId={facultad.id} />
            </div>
            {carreras.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Sin carreras todavía.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {carreras.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    <form action={renameCarreraAction.bind(null, c.id)} className="flex flex-1 gap-2">
                      <input name="nombre" defaultValue={c.nombre} required className="input !py-1" aria-label="Nombre de la carrera" />
                      <button type="submit" className="btn btn-secondary !px-2 !py-1 text-xs" title="Guardar nombre">
                        ✓
                      </button>
                    </form>
                    <form action={deleteCarreraAction.bind(null, c.id)}>
                      <ConfirmButton
                        className="btn btn-danger !px-2 !py-1 text-xs"
                        message={`¿Eliminar la carrera “${c.nombre}”? Sus artes quedarán como “Toda la facultad”.`}
                      >
                        ✕
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="font-semibold">Ajustes</h2>
            <div className="mt-3">
              <AjustesFacultadForm id={facultad.id} nombre={facultad.nombre} activa={facultad.activa} />
            </div>
            <form action={deleteFacultadAction.bind(null, facultad.id)} className="mt-4 border-t border-border pt-4">
              <ConfirmButton message={`¿Eliminar “${facultad.nombre}” con todas sus carreras, artes e historial? No se puede deshacer.`}>
                Eliminar facultad
              </ConfirmButton>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
