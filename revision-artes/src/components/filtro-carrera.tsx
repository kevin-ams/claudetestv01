import Link from "next/link";

type Carrera = { id: number; nombre: string };
type ConCarrera = { id: number | null; carrera_id: number | null };

/** Aplica ?carrera=<id>|general a la lista de campañas. "Otros artes" solo sale sin filtro. */
export function filtrarCampanas<T extends ConCarrera>(campanas: T[], carrera?: string): T[] {
  if (!carrera) return campanas;
  if (carrera === "general") return campanas.filter((c) => c.id !== null && c.carrera_id === null);
  return campanas.filter((c) => c.id !== null && String(c.carrera_id) === carrera);
}

/** Chips para filtrar las campañas por carrera (primera vista del admin y del portal). */
export function FiltroCarrera({
  base,
  actual,
  carreras,
  campanas,
}: {
  base: string;
  actual?: string;
  carreras: Carrera[];
  campanas: ConCarrera[];
}) {
  if (carreras.length === 0) return null;
  const contar = (valor?: string) => filtrarCampanas(campanas, valor).filter((c) => c.id !== null).length;
  const opciones = [
    { valor: undefined, etiqueta: "Todas las carreras" },
    { valor: "general", etiqueta: "Toda la facultad" },
    ...carreras.map((c) => ({ valor: String(c.id), etiqueta: c.nombre })),
  ].filter((o) => o.valor === undefined || contar(o.valor) > 0);

  return (
    <nav aria-label="Filtrar por carrera" className="flex flex-wrap gap-2" data-guia="filtro-carrera">
      {opciones.map((o) => {
        const activo = (actual ?? undefined) === o.valor;
        return (
          <Link
            key={o.valor ?? "todas"}
            href={o.valor ? `${base}?carrera=${o.valor}` : base}
            aria-current={activo ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activo ? "bg-accent text-accent-foreground" : "bg-surface text-foreground shadow-sm hover:bg-surface-hover"
            }`}
          >
            {o.etiqueta}
            {o.valor !== undefined && <span className="ml-1 opacity-70">({contar(o.valor)})</span>}
          </Link>
        );
      })}
    </nav>
  );
}
