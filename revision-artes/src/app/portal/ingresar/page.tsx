import { Logo } from "@/components/logo";
import { redirect } from "next/navigation";
import { Card } from "@heroui/react";
import { getPortalSession } from "@/lib/auth/session";
import { normalizarCodigo } from "@/lib/domain/facultades";
import { IngresarForm } from "./ingresar-form";

export default async function IngresarPage({ searchParams }: PageProps<"/portal/ingresar">) {
  const { codigo, next } = await searchParams;
  const destino = typeof next === "string" && /^\/portal(\/[\w-]+)*$/.test(next) ? next : "/portal";
  const actual = await getPortalSession();
  // Si ya hay sesión de la misma facultad, ir directo; con otro código, volver a ingresar.
  if (actual && (typeof codigo !== "string" || normalizarCodigo(codigo) === actual.facultad.codigo_acceso)) {
    redirect(destino);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <Logo size={52} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Portal de facultades</p>
            <p className="font-bold leading-tight">Revisión de Artes</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Ingresa tus datos para revisar y aprobar los artes de tu facultad. Tu nombre y correo quedarán
          registrados en cada aprobación o comentario.
        </p>
        <IngresarForm codigo={typeof codigo === "string" ? codigo : ""} next={destino} />
      </Card>
    </div>
  );
}
