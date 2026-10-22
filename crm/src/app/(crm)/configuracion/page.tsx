import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { requireSession } from "@/lib/auth/session";
import { defaultPipelineId, listStages } from "@/lib/domain/pipeline";
import { listUsers } from "@/lib/domain/users";
import { StageEditor } from "./stage-editor";
import { UserManager, type UserRow } from "./user-manager";

export default async function SettingsPage() {
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  const stages = await listStages(await defaultPipelineId());
  const users: UserRow[] = isAdmin
    ? (await listUsers()).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        hasPassword: u.password_hash !== null,
        hasGoogle: u.google_sub !== null,
        lastLoginAt: u.last_login_at,
      }))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted">Ajustes generales del CRM</p>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Etapas del pipeline</h2>
        <p className="mt-1 text-sm text-muted">
          Reordena, renombra, agrega o quita etapas. La probabilidad alimenta el pronóstico ponderado.
          Siempre debe existir al menos una etapa de ganado y una de perdido.
        </p>
        <StageEditor stages={stages} canEdit={isAdmin} />
      </section>

      {isAdmin && (
        <section className="card p-5">
          <h2 className="font-semibold">Usuarios y acceso</h2>
          <p className="mt-1 text-sm text-muted">
            El equipo de Ams Studio entra con Google. Para personas externas o como acceso de respaldo,
            crea un usuario con contraseña.
          </p>
          <UserManager users={users} currentUserId={session.userId} minLength={MIN_PASSWORD_LENGTH} />
        </section>
      )}
    </div>
  );
}
