// Símbolo de Ams Studio: dos formas que se solapan.
// `onBrand` es la versión clara para usar sobre fondo azul.
const PALETTES = {
  default: { left: "#5b7bff", right: "#2563ff", overlap: "#8da5ff" },
  onBrand: { left: "#f4f6ff", right: "#d9defb", overlap: "#8da5ff" },
};

export function LogoSymbol({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: keyof typeof PALETTES;
}) {
  const c = PALETTES[variant];
  return (
    <svg viewBox="80 35 485 286" className={className} aria-hidden="true">
      <path
        d="M88 140 Q88 115 113 115 L135 115 C200 115 250 132 287 160 C330 195 360 250 360 313 L113 313 Q88 313 88 288 Z"
        fill={c.left}
      />
      <path
        d="M233 313 C233 250 255 200 287 160 C340 95 420 43 520 43 Q557 43 557 80 L557 288 Q557 313 532 313 Z"
        fill={c.right}
      />
      <path
        d="M233 313 C233 250 255 200 287 160 C330 195 360 250 360 313 Z"
        fill={c.overlap}
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoSymbol className="h-6 w-auto" />
      <span className="text-lg tracking-tight text-ink">
        <span className="font-extrabold">Ams</span>{" "}
        <span className="font-medium">CRM</span>
      </span>
    </span>
  );
}
