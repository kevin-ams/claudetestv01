import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countAdmins } from "@/lib/domain/admins";
import { setupAction } from "../auth-actions";
import { AuthForm } from "../auth-form";

export default async function SetupPage() {
  // Depende de la base de datos: nunca debe prerenderizarse.
  await connection();
  if ((await countAdmins()) > 0) redirect("/admin/login");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Primera configuración</p>
        <h1 className="mt-1 text-xl font-bold">Crea la cuenta de administración</h1>
        <p className="mt-1 text-sm text-muted">
          Esta cuenta podrá crear facultades, carreras y artes. Después podrás agregar más administradores.
        </p>
        <AuthForm
          action={setupAction}
          submitLabel="Crear cuenta"
          fields={[
            { name: "name", label: "Nombre", type: "text", autoComplete: "name" },
            { name: "email", label: "Correo", type: "email", autoComplete: "email" },
            { name: "password", label: "Contraseña (mín. 8 caracteres)", type: "password", autoComplete: "new-password" },
          ]}
        />
      </div>
    </div>
  );
}
