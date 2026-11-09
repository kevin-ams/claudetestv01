import { CircleCheck, CircleXmark, TriangleExclamation } from "@gravity-ui/icons";

/** Ícono de estado (correcto, error o aviso) alineado con el texto que lo acompaña. */
export function StatusIcon({ status, size = 14 }: { status: "ok" | "error" | "warning" | boolean; size?: number }) {
  const s = status === true ? "ok" : status === false ? "error" : status;
  const Icon = s === "ok" ? CircleCheck : s === "error" ? CircleXmark : TriangleExclamation;
  return <Icon width={size} height={size} className="mr-1 inline-block shrink-0 align-[-2px]" aria-hidden />;
}
