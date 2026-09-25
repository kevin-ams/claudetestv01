import { redirect } from "next/navigation";
import { NoDatabase } from "@/components/no-database";
import { isDatabaseConfigured } from "@/lib/db";
import { countUsers } from "@/lib/domain/users";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!isDatabaseConfigured()) return <NoDatabase />;

  const existing = await countUsers();
  if (existing > 0) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
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
