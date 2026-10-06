import Link from "next/link";
import { Card } from "@heroui/react";
import type { Arte } from "@/lib/domain/artes";
import { formatFecha } from "@/lib/format";
import { driveThumbnailUrl, parseDriveUrl } from "@/lib/drive";
import { EstadoBadge } from "./estado-badge";

export function ArteCard({ arte, href }: { arte: Arte; href: string }) {
  const ref = parseDriveUrl(arte.drive_url);
  const thumb = ref ? driveThumbnailUrl(ref) : null;
  return (
    <Link href={href} className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-accent">
      <Card className="h-full overflow-hidden p-0 transition-shadow group-hover:shadow-lg">
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-secondary text-xs text-muted">
          {thumb ? (
            // Miniatura servida por Google Drive: no pasa por el optimizador de imágenes.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={arte.titulo} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span>📁 Carpeta de Drive</span>
          )}
        </div>
        <Card.Header className="px-4 pt-3">
          <div className="flex items-start justify-between gap-2">
            <Card.Title className="text-sm leading-snug">{arte.titulo}</Card.Title>
            <span className="shrink-0 text-xs text-muted">v{arte.version}</span>
          </div>
          <Card.Description className="text-xs">
            {arte.carrera_nombre ?? "Toda la facultad"}
            {arte.campana && ` · ${arte.campana}`}
          </Card.Description>
        </Card.Header>
        <Card.Footer className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
          <EstadoBadge estado={arte.estado} />
          {arte.fecha_publicacion && (
            <span className="text-xs text-muted">📅 {formatFecha(arte.fecha_publicacion)}</span>
          )}
        </Card.Footer>
      </Card>
    </Link>
  );
}
