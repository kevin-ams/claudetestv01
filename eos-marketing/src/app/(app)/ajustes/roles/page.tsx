import { getAccess } from "@/lib/auth/access";
import { listRoles } from "@/lib/domain/roles";
import { isPlatformOwner, platformOwnerNames } from "@/lib/auth/platform";
import { SettingsHeader } from "../settings-header";
import { RolesEditor } from "./roles-editor";

export default async function RolesPage() {
  const access = await getAccess();
  if (!access) return null;
  const [roles, owner, ownerName] = await Promise.all([
    listRoles(access.session.teamId),
    isPlatformOwner(access.session.userId),
    platformOwnerNames(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Roles y accesos"
        description="Define qué módulos puede ver o editar cada rol. Luego asigna el rol a cada persona en Ajustes › Equipo."
      />
      <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted">
        <b className="text-foreground">Premium:</b> el rol <b>Administrador Premium</b> incluye todo lo de Administrador más los módulos
        premium (Conocimiento / Vault). Solo el dueño de la plataforma ({ownerName}
        {owner ? ", tú" : ""}) puede asignarlo a una persona o abrir un módulo premium a otro rol.
      </p>
      <RolesEditor roles={roles} canEdit={access.isAdmin} isOwner={owner} />
    </div>
  );
}
