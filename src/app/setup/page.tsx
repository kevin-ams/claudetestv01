import { redirect } from "next/navigation";
import { countUsers } from "@/lib/domain/users";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const existing = await countUsers();
  if (existing > 0) {
    redirect("/login");
  }

  return (
    <div
      className="flex flex-1 items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(600px 400px at 15% 20%, rgb(99 102 241 / 0.35), transparent 70%), radial-gradient(600px 400px at 85% 80%, rgb(217 70 239 / 0.3), transparent 70%), linear-gradient(135deg, #172a45, #1b2150)",
      }}
    >
      <div className="tone-dashboard card animate-in w-full shadow-2xl shadow-indigo-900/40 max-w-md p-8">
        <span className="icon-chip icon-chip-solid mb-4 !h-12 !w-12 !rounded-2xl text-xl" aria-hidden>✨</span>
        <h1 className="text-xl font-bold">Configura tu sistema EOS</h1>
        <p className="mt-1 text-sm text-muted">
          Esta es la primera vez que se usa esta aplicación. Crea tu equipo y tu
          cuenta de administrador para empezar.
        </p>
        <SetupForm />
      </div>
    </div>
  );
}
