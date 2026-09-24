import { getSession } from "@/lib/auth/session";
import { runDiagnostics } from "@/lib/domain/diagnostics";
import { SettingsHeader } from "../settings-header";

export const dynamic = "force-dynamic";

export default async function DiagnosticoPage() {
  const session = await getSession();
  if (!session) return null;
  const checks = await runDiagnostics(session.teamId);
  const failed = checks.filter((c) => !c.ok).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsHeader
        title="Diagnóstico"
        description="Pruebas rápidas de la base de datos, la carpeta de imágenes y el entorno. Si algo no guarda o no carga, empieza aquí."
      />
      <p
        role="status"
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${failed ? "bg-red-bg text-red" : "bg-green-bg text-green"}`}
      >
        {failed ? `✕ ${failed} prueba(s) con error` : "✓ Todo funciona correctamente"}
      </p>
      <ul className="eos-card divide-y divide-border">
        {checks.map((c) => (
          <li key={c.name} className="flex items-start gap-3 p-4">
            <span className={`mt-0.5 font-bold ${c.ok ? "text-green" : "text-red"}`} aria-hidden>
              {c.ok ? "✓" : "✕"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{c.name}</p>
              <p className={`break-words text-sm ${c.ok ? "text-muted" : "text-red"}`}>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Si la base de datos falla en lectura o escritura, detén la app (Ctrl + C) y vuelve a correr{" "}
        <code>npm run dev</code>. Si sigue fallando, la base pudo dañarse: renombra la carpeta <code>.data</code> (así
        conservas una copia) y abre la app de nuevo para empezar con una base limpia.
      </p>
    </div>
  );
}
