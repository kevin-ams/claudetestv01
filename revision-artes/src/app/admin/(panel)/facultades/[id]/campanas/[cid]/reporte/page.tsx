import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { getCampana } from "@/lib/domain/campanas";
import { reporteCampana, tokenReporte } from "@/lib/domain/reporte";
import { emailConfigured } from "@/lib/email";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { BotonImprimir } from "@/components/reporte/imprimir";
import { ReporteDiseno } from "@/components/reporte/reporte-diseno";
import { crearEnlaceReporteAction, revocarEnlaceReporteAction } from "../../../../../actions";
import { EnviarReporteForm } from "./compartir";
import { Button } from "@heroui/react";

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ReporteAdminPage({
  params,
  searchParams,
}: PageProps<"/admin/facultades/[id]/campanas/[cid]/reporte">) {
  await requireAdmin();
  const { id, cid } = await params;
  const { todos } = await searchParams;
  const campana = await getCampana(Number(cid), Number(id));
  if (!campana) notFound();
  const soloCambios = todos !== "1";
  const [reporte, token] = await Promise.all([reporteCampana(campana.id, soloCambios), tokenReporte(campana.id)]);
  if (!reporte) notFound();
  const enlace = token ? `${await baseUrl()}/reporte/${token}` : null;
  const base = `/admin/facultades/${id}/campanas/${cid}/reporte`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 print:hidden">
        <Link href={`/admin/facultades/${id}/campanas/${cid}`} className="text-sm text-muted hover:underline">
          ← {campana.nombre}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={base}
              className={`rounded-full px-3 py-1 font-medium ${soloCambios ? "bg-accent text-accent-foreground" : "bg-surface shadow-sm"}`}
            >
              Solo artes con cambios
            </Link>
            <Link
              href={`${base}?todos=1`}
              className={`rounded-full px-3 py-1 font-medium ${!soloCambios ? "bg-accent text-accent-foreground" : "bg-surface shadow-sm"}`}
            >
              Todos los artes
            </Link>
          </div>
          <BotonImprimir />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <Card.Header>
              <Card.Title>Enlace para Diseño</Card.Title>
              <Card.Description>
                Se abre sin cuenta y siempre muestra los cambios pendientes de la versión actual. Puedes
                revocarlo cuando quieras.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              {enlace ? (
                <>
                  <code className="break-all rounded-xl bg-surface-secondary p-3 text-xs">{enlace}</code>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={enlace} label="Copiar enlace" />
                    <a href={enlace} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline">
                      Abrir ↗
                    </a>
                    <form action={revocarEnlaceReporteAction.bind(null, campana.id)}>
                      <ConfirmButton
                        size="sm"
                        title="¿Revocar el enlace?"
                        message="Quien tenga el enlace actual ya no podrá ver el reporte. Puedes crear uno nuevo después."
                        confirmLabel="Revocar"
                      >
                        Revocar
                      </ConfirmButton>
                    </form>
                  </div>
                </>
              ) : (
                <form action={crearEnlaceReporteAction.bind(null, campana.id)}>
                  <Button type="submit" variant="secondary">
                    Crear enlace para Diseño
                  </Button>
                </form>
              )}
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Enviar por correo</Card.Title>
              <Card.Description>Envía el enlace con un resumen de los artes con cambios.</Card.Description>
            </Card.Header>
            <Card.Content>
              <EnviarReporteForm campanaId={campana.id} correoDisponible={emailConfigured()} />
            </Card.Content>
          </Card>
        </div>
      </div>

      <ReporteDiseno reporte={reporte} soloCambios={soloCambios} />
    </div>
  );
}
