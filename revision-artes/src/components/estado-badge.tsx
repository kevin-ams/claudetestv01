import { Chip } from "@heroui/react";
import { ESTADOS, type EstadoArte } from "@/lib/domain/types";

export function EstadoBadge({ estado, size = "sm" }: { estado: EstadoArte; size?: "sm" | "md" | "lg" }) {
  const { label, color } = ESTADOS[estado];
  return (
    <Chip color={color} variant="soft" size={size}>
      {label}
    </Chip>
  );
}
