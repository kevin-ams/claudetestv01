import { getSession } from "@/lib/auth/session";
import {
  CALLS_REVALIDATE_SECONDS,
  callsSourceConfigured,
  loadCalls,
} from "@/lib/calls/source";
import { CallsDashboard } from "./calls-dashboard";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Campaña de llamadas" };

function SetupNotice({ error }: { error?: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Campaña de llamadas</h1>
      <div className="card mt-6 p-6">
        {error ? (
          <>
            <p className="font-semibold text-red">No se pudo leer la hoja de Google</p>
            <p className="mt-1 text-sm">{error}</p>
          </>
        ) : (
          <p className="font-semibold">Falta conectar la hoja de Google Sheets</p>
        )}
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            En Google Cloud crea una cuenta de servicio con la API de Google Sheets habilitada
            y descarga su llave JSON.
          </li>
          <li>Comparte la hoja de llamadas con el correo de la cuenta de servicio, como Lector.</li>
          <li>
            En Netlify → Project configuration → Environment variables agrega{" "}
            <code>CALLS_SHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> y{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>, y vuelve a desplegar.
          </li>
        </ol>
        {error && (
          <div className="mt-4">
            <SyncButton />
          </div>
        )}
      </div>
    </div>
  );
}

export default async function CallsPage() {
  const session = await getSession();
  if (!session) return null;
  if (!callsSourceConfigured()) return <SetupNotice />;

  let dataset;
  try {
    dataset = await loadCalls();
  } catch (e) {
    return <SetupNotice error={e instanceof Error ? e.message : String(e)} />;
  }

  // El correo no se usa en el tablero: no lo mandamos al navegador.
  const records = dataset.records.map((r) => ({ ...r, email: "" }));
  const sheetUrl = process.env.CALLS_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.CALLS_SHEET_ID}/edit`
    : null;

  return (
    <CallsDashboard
      records={records}
      sheetTitle={dataset.sheetTitle}
      syncedAt={dataset.syncedAt}
      refreshMinutes={CALLS_REVALIDATE_SECONDS / 60}
      sheetUrl={sheetUrl}
      warnings={dataset.warnings}
    />
  );
}
