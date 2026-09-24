import Link from "next/link";

/** Encabezado de las páginas dentro de Ajustes, con regreso al índice. */
export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm text-muted">
        <Link href="/ajustes" className="text-primary underline">
          Ajustes
        </Link>{" "}
        / {title}
      </p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}
