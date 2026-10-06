import { fechaHora } from "@/lib/format";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listFacultadesResumen } from "@/lib/domain/facultades";
import { listActividadReciente } from "@/lib/domain/artes";
import { ACCIONES } from "@/lib/domain/types";
import { CrearFacultadForm } from "./crear-facultad-form";


export default async function AdminHome() {
  await requireAdmin();
  const [facultades, actividad] = await Promise.all([listFacultadesResumen(), listActividadReciente()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Facultades</h1>
          <p className="text-sm text-muted">
            Cada facultad entra al portal con su propio código y solo ve sus artes.
          </p>
        </div>
        <div className="card p-4">
          <CrearFacultadForm />
        </div>
        {facultades.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">Aún no hay facultades. Agrega la primera arriba.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {facultades.map((f) => (
              <li key={f.id}>
                <Link href={`/admin/facultades/${f.id}`} className="card block p-4 transition hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{f.nombre}</h2>
                    {!f.activa && <span className="badge bg-background text-muted">Inactiva</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {f.carreras} {f.carreras === 1 ? "carrera" : "carreras"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="badge bg-amber-bg text-amber">{f.pendientes} pendientes</span>
                    <span className="badge bg-red-bg text-red">{f.cambios} con cambios</span>
                    <span className="badge bg-green-bg text-green">{f.aprobados} aprobados</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="card h-fit p-4">
        <h2 className="font-semibold">Actividad reciente de facultades</h2>
        {actividad.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin actividad todavía.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {actividad.map((a) => (
              <li key={a.id} className="text-sm">
                <Link href={`/admin/artes/${a.arte_id}`} className="hover:underline">
                  <span className="font-medium">{a.autor_nombre}</span> {ACCIONES[a.accion]}{" "}
                  <span className="font-medium">“{a.arte_titulo}”</span>
                </Link>
                <p className="text-xs text-muted">
                  {a.facultad_nombre} · {fechaHora.format(new Date(a.created_at))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
