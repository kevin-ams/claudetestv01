import { fechaHora } from "@/lib/format";
import { ACCIONES } from "@/lib/domain/types";
import type { Anotacion, Revision } from "@/lib/domain/artes";

const COLOR: Record<Revision["accion"], string> = {
  aprobado: "bg-success",
  cambios: "bg-danger",
  comentario: "bg-muted",
  nueva_version: "bg-accent",
  notificacion: "bg-accent",
};

export function Historial({
  revisiones,
  anotaciones,
  showEmail,
  ocultar = [],
}: {
  revisiones: Revision[];
  anotaciones: Anotacion[];
  showEmail: boolean;
  /** Acciones que no se muestran (p. ej. los avisos por correo en el portal). */
  ocultar?: Revision["accion"][];
}) {
  revisiones = revisiones.filter((r) => !ocultar.includes(r.accion));
  if (revisiones.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay revisiones.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {revisiones.map((r) => {
        const puntos = anotaciones.filter((a) => a.revision_id === r.id);
        return (
          <li key={r.id} className="flex gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR[r.accion]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{r.autor_nombre}</span>
                {r.autor_tipo === "admin" && <span className="text-muted"> (Marketing Digital)</span>}{" "}
                {ACCIONES[r.accion]} <span className="text-muted">· v{r.version}</span>
              </p>
              <p className="text-xs text-muted">
                {fechaHora.format(new Date(r.created_at))}
                {showEmail && ` · ${r.autor_email}`}
              </p>
              {r.comentario && (
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-secondary p-2 text-sm">{r.comentario}</p>
              )}
              {puntos.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {puntos.map((p) => (
                    <li key={p.id} className="flex gap-2 text-sm">
                      <span className="font-semibold text-danger">#{p.numero}</span>
                      <span className={p.atendida ? "text-muted line-through" : ""}>{p.comentario}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
