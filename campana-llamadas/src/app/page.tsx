import { redirect } from "next/navigation";
import { CallsDashboard } from "@/components/dashboard/calls-dashboard";
import { UploadButton } from "@/components/dashboard/upload-button";
import { logoutAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";
import { loadCalls } from "@/lib/calls/storage";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const dataset = await loadCalls();

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-primary px-4 text-primary-foreground md:px-8 print:hidden">
        <span className="font-bold tracking-tight">📞 Campaña de llamadas</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-white/80 sm:inline">{session.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 print:p-0">
        {dataset ? (
          <CallsDashboard
            // El correo no se usa en el tablero: no lo mandamos al navegador.
            records={dataset.records.map((r) => ({ ...r, email: "" }))}
            fileName={dataset.fileName}
            uploadedAt={dataset.uploadedAt}
            uploadedBy={dataset.uploadedBy}
            warnings={dataset.warnings}
          />
        ) : (
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold">Campaña de llamadas</h1>
            <div className="card mt-6 p-6">
              <p className="font-semibold">Sube el archivo de la campaña para ver el dashboard</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Abre la hoja de llamadas en Google Sheets.</li>
                <li>
                  Ve a <strong>Archivo → Descargar → Microsoft Excel (.xlsx)</strong>.
                </li>
                <li>Sube aquí ese archivo. Cada vez que se actualice la hoja, vuelve a subirlo.</li>
              </ol>
              <div className="mt-5 flex">
                <UploadButton label="↑ Subir archivo" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
