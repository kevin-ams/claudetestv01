import { ESTADOS, type EstadoArte } from "@/lib/domain/types";

export function EstadoBadge({ estado }: { estado: EstadoArte }) {
  const { label, className } = ESTADOS[estado];
  return <span className={`badge ${className}`}>{label}</span>;
}
