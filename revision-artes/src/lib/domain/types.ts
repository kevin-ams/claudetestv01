export type EstadoArte = "pendiente" | "aprobado" | "cambios";

export type AccionRevision = "aprobado" | "cambios" | "comentario" | "nueva_version";

export const ESTADOS: Record<EstadoArte, { label: string; color: "warning" | "success" | "danger" }> = {
  pendiente: { label: "Pendiente", color: "warning" },
  aprobado: { label: "Aprobado", color: "success" },
  cambios: { label: "Cambios solicitados", color: "danger" },
};

export const ACCIONES: Record<AccionRevision, string> = {
  aprobado: "aprobó",
  cambios: "solicitó cambios",
  comentario: "comentó",
  nueva_version: "subió una nueva versión",
};
