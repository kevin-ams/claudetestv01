import { fechaHora } from "@/lib/format";
import { ACCIONES } from "@/lib/domain/types";
import type { Revision } from "@/lib/domain/artes";


const COLOR: Record<Revision["accion"], string> = {
  aprobado: "bg-green",
  cambios: "bg-red",
  comentario: "bg-muted",
  nueva_version: "bg-primary",
};

export function Historial({ revisiones, showEmail }: { revisiones: Revision[]; showEmail: boolean }) {
  if (revisiones.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay revisiones.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {revisiones.map((r) => (
        <li key={r.id} className="flex gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR[r.accion]}`} />
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-semibold">{r.autor_nombre}</span>
              {r.autor_tipo === "admin" && <span className="text-muted"> (Comunicación)</span>}{" "}
              {ACCIONES[r.accion]} <span className="text-muted">· v{r.version}</span>
            </p>
            <p className="text-xs text-muted">
              {fechaHora.format(new Date(r.created_at))}
              {showEmail && ` · ${r.autor_email}`}
            </p>
            {r.comentario && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-background p-2 text-sm">{r.comentario}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
