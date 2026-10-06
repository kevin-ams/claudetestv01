/** Encabezado de marca para pantallas de acceso. */
export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-black text-accent-foreground">
        GES
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{subtitulo}</p>
        <p className="font-bold leading-tight">Administrador de Revisión de Artes</p>
      </div>
    </div>
  );
}
