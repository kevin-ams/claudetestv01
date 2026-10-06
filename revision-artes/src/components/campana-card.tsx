import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import type { CampanaResumen } from "@/lib/domain/campanas";
import { formatFecha } from "@/lib/format";

export function CampanaCard({
  campana,
  href,
  ...rest
}: {
  campana: CampanaResumen;
  href: string;
  "data-guia"?: string;
}) {
  const porRevisar = campana.pendientes + campana.cambios;
  return (
    <Link href={href} {...rest} className="group block h-full rounded-3xl focus-visible:outline-2 focus-visible:outline-accent">
      <Card className={`h-full transition-shadow group-hover:shadow-lg ${campana.id === null ? "bg-surface-secondary" : ""}`}>
        <Card.Header>
          <div className="flex items-start justify-between gap-2">
            <Card.Title className="text-base">{campana.nombre}</Card.Title>
            {campana.pendientes > 0 && (
              <span data-guia="pendientes-campana" className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-warning px-2 text-xs font-bold text-warning-foreground">
                {campana.pendientes}
              </span>
            )}
          </div>
          {campana.descripcion && <Card.Description className="line-clamp-2">{campana.descripcion}</Card.Description>}
        </Card.Header>
        <Card.Content className="text-sm text-muted">
          {campana.total === 0
            ? "Sin artes todavía"
            : porRevisar > 0
              ? `${porRevisar} de ${campana.total} ${campana.total === 1 ? "arte" : "artes"} por revisar`
              : `Todo revisado (${campana.total} ${campana.total === 1 ? "arte" : "artes"})`}
          {campana.proxima_fecha && <span className="block text-xs">📅 Próxima publicación: {formatFecha(campana.proxima_fecha)}</span>}
          {campana.creado_por_nombre && <span className="block text-xs">Creada por {campana.creado_por_nombre}</span>}
        </Card.Content>
        <Card.Footer className="flex flex-wrap gap-2" data-guia="contadores">
          <Chip size="sm" color="warning" variant="soft">{campana.pendientes} pendientes</Chip>
          <Chip size="sm" color="danger" variant="soft">{campana.cambios} con cambios</Chip>
          <Chip size="sm" color="success" variant="soft">{campana.aprobados} aprobados</Chip>
        </Card.Footer>
      </Card>
    </Link>
  );
}
