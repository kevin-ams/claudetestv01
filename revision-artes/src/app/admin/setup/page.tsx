import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card } from "@heroui/react";
import { countAdmins } from "@/lib/domain/admins";
import { setupAction } from "../auth-actions";
import { AuthForm } from "../auth-form";
import { Marca } from "../marca";

export default async function SetupPage() {
  // Depende de la base de datos: nunca debe prerenderizarse.
  await connection();
  if ((await countAdmins()) > 0) redirect("/admin/login");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <Marca subtitulo="Primera configuración" />
        <p className="mt-4 text-sm text-muted">
          Crea la cuenta de administración. Podrá crear facultades, carreras y artes, y agregar más
          administradores.
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
      </Card>
    </div>
  );
}
