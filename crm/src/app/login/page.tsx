import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoSymbol } from "@/components/logo";
import { isDevLoginEnabled } from "@/lib/auth/dev";
import { allowedDomain, isGoogleConfigured } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";
import { countUsers } from "@/lib/domain/users";
import { PasswordForm } from "./password-form";

const ERRORS: Record<string, string> = {
  domain: "Con Google solo pueden entrar cuentas de Ams Studio. Si eres externo, usa correo y contraseña.",
  state: "La sesión de inicio expiró. Intenta de nuevo.",
  google: "Google no pudo completar el inicio de sesión. Intenta de nuevo.",
  config: "El inicio de sesión con Google aún no está configurado.",
  inactive: "Tu acceso está desactivado. Contacta a un administrador.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  // Con ?error=inactive la cookie sigue presente; no redirigir para no entrar en bucle.
  if (error !== "inactive" && (await getSession())) redirect("/");

  const message = typeof error === "string" ? ERRORS[error] : undefined;
  const needsSetup = (await countUsers()) === 0;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <LogoSymbol variant="onBrand" className="h-8 w-auto" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Ams CRM</h1>
        <p className="mt-1 text-sm text-muted">
          Equipo de {allowedDomain()}: entra con Google
        </p>

        {message && (
          <p className="mt-4 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">{message}</p>
        )}

        {needsSetup && (
          <Link href="/setup" className="btn btn-primary mt-6 w-full">
            Crear la primera cuenta de administrador
          </Link>
        )}

        <a
          href="/api/auth/google"
          aria-disabled={!isGoogleConfigured()}
          className={`btn btn-primary mt-6 w-full ${isGoogleConfigured() ? "" : "pointer-events-none opacity-40"}`}
        >
          Continuar con Google
        </a>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          o con una cuenta asignada
          <span className="h-px flex-1 bg-border" />
        </div>

        <PasswordForm />

        {isDevLoginEnabled() && (
          <form action="/api/auth/dev" method="post" className="mt-3">
            <button type="submit" className="btn btn-ghost w-full text-xs">
              Entrar en modo desarrollo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
