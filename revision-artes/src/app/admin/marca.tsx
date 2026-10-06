import { Logo } from "@/components/logo";
/** Encabezado de marca para pantallas de acceso. */
export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={52} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{subtitulo}</p>
        <p className="font-bold leading-tight">Administrador de Revisión de Artes</p>
      </div>
    </div>
  );
}
