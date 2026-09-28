import { getSession } from "@/lib/auth/session";
import { loadCalls } from "@/lib/calls/source";
import { CallsDashboard } from "./calls-dashboard";
import { UploadButton } from "./upload-button";

export const metadata = { title: "Campaña de llamadas" };

export default async function CallsPage() {
  const session = await getSession();
  if (!session) return null;

  const dataset = await loadCalls(session.teamId);

  if (!dataset) {
    return (
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
          <div className="mt-5 flex justify-start">
            <UploadButton label="↑ Subir archivo" />
          </div>
        </div>
      </div>
    );
  }

  // El correo no se usa en el tablero: no lo mandamos al navegador.
  const records = dataset.records.map((r) => ({ ...r, email: "" }));

  return (
    <CallsDashboard
      records={records}
      fileName={dataset.fileName}
      uploadedAt={dataset.uploadedAt}
      uploadedBy={dataset.uploadedBy}
      warnings={dataset.warnings}
    />
  );
}
