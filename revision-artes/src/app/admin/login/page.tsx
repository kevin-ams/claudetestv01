import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { countAdmins } from "@/lib/domain/admins";
import { loginAction } from "../auth-actions";
import { AuthForm } from "../auth-form";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  if ((await countAdmins()) === 0) redirect("/admin/setup");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Administración</p>
        <h1 className="mt-1 text-xl font-bold">Revisión de Artes</h1>
        <AuthForm
          action={loginAction}
          submitLabel="Entrar"
          fields={[
            { name: "email", label: "Correo", type: "email", autoComplete: "email" },
            { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
          ]}
        />
      </div>
    </div>
  );
}
