import { redirect } from "next/navigation";
import { LogoSymbol } from "@/components/logo";
import { countUsers } from "@/lib/domain/users";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand">
          <LogoSymbol variant="onBrand" className="h-6 w-auto" />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">Primer administrador</h1>
        <p className="mt-1 text-sm text-muted">
          Esta cuenta con contraseña sirve como acceso de respaldo si Google no está disponible.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
