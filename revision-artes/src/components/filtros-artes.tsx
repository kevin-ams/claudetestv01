import Link from "next/link";
import { ESTADOS, type EstadoArte } from "@/lib/domain/types";
import type { Arte } from "@/lib/domain/artes";

export type Filtros = { carrera?: string; estado?: string };

/** Aplica los filtros de la URL (?carrera=ID|general & ?estado=...). */
export function filtrarArtes(artes: Arte[], f: Filtros): Arte[] {
  return artes.filter((a) => {
    if (f.estado && a.estado !== f.estado) return false;
    if (f.carrera === "general") return a.carrera_id === null;
    if (f.carrera && String(a.carrera_id) !== f.carrera) return false;
    return true;
  });
}

function hrefCon(base: string, f: Filtros, cambio: Filtros) {
  const params = new URLSearchParams();
  const merged = { ...f, ...cambio };
  if (merged.carrera) params.set("carrera", merged.carrera);
  if (merged.estado) params.set("estado", merged.estado);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "bg-surface text-foreground shadow-sm hover:bg-surface-hover"
      }`}
    >
      {children}
    </Link>
  );
}

export function FiltrosArtes({
  base,
  filtros,
  carreras,
  artes,
}: {
  base: string;
  filtros: Filtros;
  carreras: { id: number; nombre: string }[];
  artes: Arte[];
}) {
  const porEstado = (e: EstadoArte) => filtrarArtes(artes, { ...filtros, estado: e }).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Chip href={hrefCon(base, filtros, { estado: undefined })} active={!filtros.estado}>
          Todos
        </Chip>
        {(Object.keys(ESTADOS) as EstadoArte[]).map((e) => (
          <Chip key={e} href={hrefCon(base, filtros, { estado: e })} active={filtros.estado === e}>
            {ESTADOS[e].label} ({porEstado(e)})
          </Chip>
        ))}
      </div>
      {carreras.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip href={hrefCon(base, filtros, { carrera: undefined })} active={!filtros.carrera}>
            Todas las carreras
          </Chip>
          <Chip href={hrefCon(base, filtros, { carrera: "general" })} active={filtros.carrera === "general"}>
            Toda la facultad
          </Chip>
          {carreras.map((c) => (
            <Chip key={c.id} href={hrefCon(base, filtros, { carrera: String(c.id) })} active={filtros.carrera === String(c.id)}>
              {c.nombre}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
