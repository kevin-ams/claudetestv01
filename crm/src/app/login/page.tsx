import { redirect } from "next/navigation";
import { LogoSymbol } from "@/components/logo";
import { isDevLoginEnabled } from "@/lib/auth/dev";
import { allowedDomain, isGoogleConfigured } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";

const ERRORS: Record<string, string> = {
  domain: "Solo pueden entrar cuentas de Google de Ams Studio.",
  state: "La sesión de inicio expiró. Intenta de nuevo.",
  google: "Google no pudo completar el inicio de sesión. Intenta de nuevo.",
  config: "El inicio de sesión con Google aún no está configurado.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/");

  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <LogoSymbol variant="onBrand" className="h-8 w-auto" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Ams CRM</h1>
        <p className="mt-1 text-sm text-muted">
          Entra con tu cuenta de {allowedDomain()}
        </p>

        {message && (
          <p className="mt-4 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">{message}</p>
        )}

        <a
          href="/api/auth/google"
          aria-disabled={!isGoogleConfigured()}
          className={`btn btn-primary mt-6 w-full ${isGoogleConfigured() ? "" : "pointer-events-none opacity-40"}`}
        >
          Continuar con Google
        </a>

        {isDevLoginEnabled() && (
          <form action="/api/auth/dev" method="post" className="mt-3">
            <button type="submit" className="btn btn-secondary w-full">
              Entrar en modo desarrollo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
