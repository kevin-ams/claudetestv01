import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { listFacultadesResumen } from "@/lib/domain/facultades";
import { listActividadReciente } from "@/lib/domain/artes";
import { ACCIONES } from "@/lib/domain/types";
import { fechaHora } from "@/lib/format";
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
        <Card className="p-4">
          <CrearFacultadForm />
        </Card>
        {facultades.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">Aún no hay facultades. Agrega la primera arriba.</Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {facultades.map((f) => (
              <li key={f.id}>
                <Link href={`/admin/facultades/${f.id}`} className="group block h-full rounded-3xl">
                  <Card className="h-full transition-shadow group-hover:shadow-lg">
                    <Card.Header>
                      <div className="flex items-start justify-between gap-2">
                        <Card.Title>{f.nombre}</Card.Title>
                        {!f.activa && (
                          <Chip size="sm" variant="soft">
                            Inactiva
                          </Chip>
                        )}
                      </div>
                      <Card.Description>
                        {f.carreras} {f.carreras === 1 ? "carrera" : "carreras"}
                      </Card.Description>
                    </Card.Header>
                    <Card.Footer className="flex flex-wrap gap-2">
                      <Chip size="sm" color="warning" variant="soft">{f.pendientes} pendientes</Chip>
                      <Chip size="sm" color="danger" variant="soft">{f.cambios} con cambios</Chip>
                      <Chip size="sm" color="success" variant="soft">{f.aprobados} aprobados</Chip>
                    </Card.Footer>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="h-fit">
        <Card.Header>
          <Card.Title>Actividad reciente de facultades</Card.Title>
        </Card.Header>
        <Card.Content>
          {actividad.length === 0 ? (
            <p className="text-sm text-muted">Sin actividad todavía.</p>
          ) : (
            <ul className="flex flex-col gap-3">
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
        </Card.Content>
      </Card>
    </div>
  );
}
