import { redirect } from "next/navigation";
import { Card } from "@heroui/react";
import { getPortalSession } from "@/lib/auth/session";
import { IngresarForm } from "./ingresar-form";

export default async function IngresarPage({ searchParams }: PageProps<"/portal/ingresar">) {
  if (await getPortalSession()) redirect("/portal");
  const { codigo } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-black text-accent-foreground">
            GES
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Portal de facultades</p>
            <p className="font-bold leading-tight">Revisión de Artes</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Ingresa tus datos para revisar y aprobar los artes de tu facultad. Tu nombre y correo quedarán
          registrados en cada aprobación o comentario.
        </p>
        <IngresarForm codigo={typeof codigo === "string" ? codigo : ""} />
      </Card>
    </div>
  );
}
