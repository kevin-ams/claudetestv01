import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { campanaPorToken, reporteCampana } from "@/lib/domain/reporte";
import { BotonImprimir } from "@/components/reporte/imprimir";
import { ReporteDiseno } from "@/components/reporte/reporte-diseno";
import { NombreDiseno } from "@/components/reporte/nombre-diseno";

export const metadata: Metadata = {
  title: "Reporte de cambios para diseño · GES",
  robots: { index: false, follow: false },
};

/** Reporte de solo lectura para Diseño (enlace secreto, sin cuenta). */
export default async function ReportePublicoPage({ params, searchParams }: PageProps<"/reporte/[token]">) {
  const { token } = await params;
  const { todos } = await searchParams;
  const campanaId = await campanaPorToken(token);
  if (!campanaId) notFound();
  const soloCambios = todos !== "1";
  const reporte = await reporteCampana(campanaId, soloCambios);
  if (!reporte) notFound();

  return (
    <main className="flex flex-1 flex-col gap-4 px-0 py-6 sm:px-4 print:p-0">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 sm:px-0 print:hidden">
        <div className="flex gap-2 text-sm">
          <a
            href={`/reporte/${token}`}
            className={`rounded-full px-3 py-1 font-medium ${soloCambios ? "bg-accent text-accent-foreground" : "bg-surface shadow-sm"}`}
          >
            Solo artes con cambios
          </a>
          <a
            href={`/reporte/${token}?todos=1`}
            className={`rounded-full px-3 py-1 font-medium ${!soloCambios ? "bg-accent text-accent-foreground" : "bg-surface shadow-sm"}`}
          >
            Todos los artes
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NombreDiseno />
          <BotonImprimir />
        </div>
      </div>
      <p className="mx-auto w-full max-w-5xl px-4 text-sm text-muted sm:px-0 print:hidden">
        ✔️ Marca cada cambio al terminarlo. Cuando completes todos los de un arte, Marketing Digital recibe un aviso
        para publicar la nueva versión.
      </p>
      <ReporteDiseno reporte={reporte} soloCambios={soloCambios} token={token} />
    </main>
  );
}
