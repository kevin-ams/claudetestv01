import Link from "next/link";
import type { Arte } from "@/lib/domain/artes";
import { formatFecha } from "@/lib/format";
import { DriveThumbnail } from "./drive-preview";
import { EstadoBadge } from "./estado-badge";

export function ArteCard({ arte, href }: { arte: Arte; href: string }) {
  return (
    <Link href={href} className="card flex flex-col transition hover:border-primary">
      <DriveThumbnail url={arte.drive_url} title={arte.titulo} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{arte.titulo}</h3>
          <span className="shrink-0 text-xs text-muted">v{arte.version}</span>
        </div>
        <p className="text-xs text-muted">
          {arte.carrera_nombre ?? "Toda la facultad"}
          {arte.campana && ` · ${arte.campana}`}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <EstadoBadge estado={arte.estado} />
          {arte.fecha_publicacion && (
            <span className="text-xs text-muted">📅 {formatFecha(arte.fecha_publicacion)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
