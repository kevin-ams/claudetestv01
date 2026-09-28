import { getSession } from "@/lib/auth/session";
import { GoogleNotConnectedError, getConnection } from "@/lib/calls/google-oauth";
import { CALLS_REVALIDATE_SECONDS, callsAuthMode, loadCalls } from "@/lib/calls/source";
import { disconnectGoogleAction } from "./actions";
import { CallsDashboard } from "./calls-dashboard";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Campaña de llamadas" };

function Notice({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Campaña de llamadas</h1>
      <div className="card mt-6 p-6">
        <p className="font-semibold">{title}</p>
        {error && <p className="mt-2 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">{error}</p>}
        <div className="mt-4 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

function ConnectNotice({ error }: { error?: string }) {
  return (
    <Notice title="Conecta la cuenta de Google que tiene acceso a la hoja" error={error}>
      <p>
        Inicia sesión una vez con una cuenta que pueda abrir la hoja de llamadas (por ejemplo tu
        cuenta institucional). La app solo pide permiso de <strong>lectura</strong> de hojas de
        cálculo y guarda la autorización cifrada.
      </p>
      <a href="/llamadas/google/connect" className="btn btn-primary mt-4">
        Conectar con Google
      </a>
    </Notice>
  );
}

function SetupNotice() {
  return (
    <Notice title="Falta conectar la hoja de Google Sheets">
      <p>
        En Netlify → Project configuration → Environment variables agrega{" "}
        <code>CALLS_SHEET_ID</code> y, o bien <code>GOOGLE_OAUTH_CLIENT_ID</code> +{" "}
        <code>GOOGLE_OAUTH_CLIENT_SECRET</code> (inicio de sesión con Google), o bien{" "}
        <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> + <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>{" "}
        (cuenta de servicio). Luego vuelve a desplegar. Detalles en el README.
      </p>
    </Notice>
  );
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { google_error: googleError } = await searchParams;

  const mode = callsAuthMode();
  if (!mode) return <SetupNotice />;

  const connection = mode === "oauth" ? await getConnection() : null;
  if (mode === "oauth" && !connection) return <ConnectNotice error={googleError} />;

  let dataset;
  try {
    dataset = await loadCalls();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (mode === "oauth" && (e instanceof GoogleNotConnectedError || /conect/i.test(message))) {
      return <ConnectNotice error={message} />;
    }
    return (
      <Notice title="No se pudo leer la hoja de Google" error={message}>
        <SyncButton />
      </Notice>
    );
  }

  // El correo no se usa en el tablero: no lo mandamos al navegador.
  const records = dataset.records.map((r) => ({ ...r, email: "" }));
  const sheetUrl = process.env.CALLS_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.CALLS_SHEET_ID}/edit`
    : null;

  return (
    <>
      {googleError && (
        <p className="mx-auto mb-4 max-w-7xl rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
          {googleError}
        </p>
      )}
      <CallsDashboard
        records={records}
        sheetTitle={dataset.sheetTitle}
        syncedAt={dataset.syncedAt}
        refreshMinutes={CALLS_REVALIDATE_SECONDS / 60}
        sheetUrl={sheetUrl}
        warnings={dataset.warnings}
      />
      {connection && (
        <div className="mx-auto mt-6 flex max-w-7xl flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            Leyendo la hoja como <strong>{connection.googleEmail ?? "cuenta de Google"}</strong>
          </span>
          <a href="/llamadas/google/connect" className="font-semibold text-primary hover:underline">
            Cambiar cuenta
          </a>
          {session.role === "admin" && (
            <form action={disconnectGoogleAction}>
              <button type="submit" className="font-semibold text-red hover:underline">
                Desconectar
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
