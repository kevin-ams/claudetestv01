import { ChevronDown } from "@gravity-ui/icons";

/**
 * Acordeón para lo que ya está aprobado: lo saca de la vista principal y lo
 * deja abajo, cerrado, para consultarlo cuando haga falta.
 */
export function GrupoAprobados({
  titulo,
  cantidad,
  children,
}: {
  titulo: string;
  cantidad: number;
  children: React.ReactNode;
}) {
  if (cantidad === 0) return null;
  return (
    <details
      data-testid="grupo-aprobados"
      data-guia="grupo-aprobados"
      className="group rounded-3xl border border-[var(--ges-aprobado-borde)] bg-[color-mix(in_oklab,var(--ges-aprobado-bg)_70%,transparent)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-5 py-4 font-semibold text-[var(--ges-aprobado-texto)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ges-aprobado-borde)] [&::-webkit-details-marker]:hidden">
        <span>
          ✓ {titulo} ({cantidad})
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Una campaña está aprobada cuando tiene artes y todos están aprobados. */
export function campanaAprobada(c: { total: number; aprobados: number }) {
  return c.total > 0 && c.aprobados === c.total;
}
