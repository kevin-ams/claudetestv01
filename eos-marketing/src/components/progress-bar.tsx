/**
 * Barra de carga. Con `value` (0–100) muestra avance real; sin `value` es
 * indeterminada (para acciones de un solo paso).
 */
export function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value?: number;
  tone?: "primary" | "green" | "red";
  label?: string;
}) {
  const color = tone === "green" ? "bg-green" : tone === "red" ? "bg-red" : "bg-primary";
  return (
    <div className="flex flex-col gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-background">
        {value === undefined ? (
          <div className={`progress-indeterminate h-full w-1/3 rounded-full ${color}`} />
        ) : (
          <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.max(4, value)}%` }} />
        )}
      </div>
      {label && <p className="text-xs text-muted">{label}</p>}
    </div>
  );
}
