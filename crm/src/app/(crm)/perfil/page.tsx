import { requireSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/domain/users";
import { ChangePasswordForm } from "./change-password-form";

export default async function ProfilePage() {
  const session = await requireSession();
  const user = await getUserById(session.userId);
  const hasPassword = Boolean(user?.password_hash);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted">{session.email}</p>
      </div>
      <section className="card p-5">
        <h2 className="font-semibold">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</h2>
        <p className="mt-1 text-sm text-muted">
          {hasPassword
            ? "Usa esta contraseña para entrar con correo si no usas Google."
            : "Opcional: te permite entrar con correo y contraseña si Google no está disponible."}
        </p>
        <ChangePasswordForm hasPassword={hasPassword} />
      </section>
    </div>
  );
}
