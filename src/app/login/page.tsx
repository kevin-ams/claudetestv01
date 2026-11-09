import Link from "next/link";
import { redirect } from "next/navigation";
import { countUsers } from "@/lib/domain/users";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const existing = await countUsers();
  if (existing === 0) {
    redirect("/setup");
  }

  return (
    <div
      className="flex flex-1 items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(600px 400px at 15% 20%, rgb(99 102 241 / 0.35), transparent 70%), radial-gradient(600px 400px at 85% 80%, rgb(217 70 239 / 0.3), transparent 70%), linear-gradient(135deg, #172a45, #1b2150)",
      }}
    >
      <div className="tone-dashboard card animate-in w-full shadow-2xl shadow-indigo-900/40 max-w-sm p-8">
        <span className="icon-chip icon-chip-solid mb-4 !h-12 !w-12 !rounded-2xl text-xl" aria-hidden>✨</span>
        <h1 className="text-xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted">
          Entra a tu sistema EOS: V/TO, Rocks, Scorecard, Issues, To-Dos y la
          Reunión Level 10.
        </p>
        <LoginForm />
        <p className="mt-6 text-xs text-muted">
          ¿Primera vez usando la app?{" "}
          <Link href="/setup" className="font-medium text-primary underline">
            Configura tu equipo
          </Link>
        </p>
      </div>
    </div>
  );
}
