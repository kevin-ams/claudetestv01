import { redirect } from "next/navigation";
import { Card } from "@heroui/react";
import { getAdminSession } from "@/lib/auth/session";
import { countAdmins } from "@/lib/domain/admins";
import { loginAction } from "../auth-actions";
import { AuthForm } from "../auth-form";
import { Marca } from "../marca";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  if ((await countAdmins()) === 0) redirect("/admin/setup");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <Marca subtitulo="Iniciar sesión" />
        <AuthForm
          action={loginAction}
          submitLabel="Entrar"
          fields={[
            { name: "email", label: "Correo", type: "email", autoComplete: "email" },
            { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
          ]}
        />
      </Card>
    </div>
  );
}
