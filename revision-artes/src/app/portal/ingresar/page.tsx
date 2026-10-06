import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/session";
import { IngresarForm } from "./ingresar-form";

export default async function IngresarPage({ searchParams }: PageProps<"/portal/ingresar">) {
  if (await getPortalSession()) redirect("/portal");
  const { codigo } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Portal de facultades</p>
        <h1 className="mt-1 text-xl font-bold">Revisión de artes</h1>
        <p className="mt-1 text-sm text-muted">
          Ingresa tus datos para revisar y aprobar los artes de tu facultad. Tu nombre y correo quedarán
          registrados en cada aprobación o comentario.
        </p>
        <IngresarForm codigo={typeof codigo === "string" ? codigo : ""} />
      </div>
    </div>
  );
}
