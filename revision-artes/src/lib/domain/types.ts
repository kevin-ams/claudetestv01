export type EstadoArte = "pendiente" | "aprobado" | "cambios";

export type AccionRevision = "aprobado" | "cambios" | "comentario" | "nueva_version";

export const ESTADOS: Record<EstadoArte, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-bg text-amber" },
  aprobado: { label: "Aprobado", className: "bg-green-bg text-green" },
  cambios: { label: "Cambios solicitados", className: "bg-red-bg text-red" },
};

export const ACCIONES: Record<AccionRevision, string> = {
  aprobado: "aprobó",
  cambios: "solicitó cambios",
  comentario: "comentó",
  nueva_version: "subió una nueva versión",
};
