import Link from "next/link";
import { redirect } from "next/navigation";
import { countUsers, isUserInTeam } from "@/lib/domain/users";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session && (await isUserInTeam(session.userId, session.teamId))) redirect("/");

  const existing = await countUsers();
  if (existing === 0) {
    redirect("/setup");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8">
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
