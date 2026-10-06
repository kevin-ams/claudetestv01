import Link from "next/link";
import type { Version } from "@/lib/domain/artes";

/** Pestañas de versiones como enlaces (?v=N). La actual va primero. */
export function VersionSelector({
  base,
  versiones,
  vista,
  actual,
}: {
  base: string;
  versiones: Version[];
  vista: number;
  actual: number;
}) {
  if (versiones.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Versiones:</span>
      {versiones.map((v) => (
        <Link
          key={v.version}
          href={v.version === actual ? base : `${base}?v=${v.version}`}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            v.version === vista ? "bg-accent text-accent-foreground" : "bg-surface-secondary hover:bg-surface-tertiary"
          }`}
        >
          v{v.version}
          {v.version === actual && " (actual)"}
        </Link>
      ))}
    </div>
  );
}
