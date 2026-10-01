import { getAccess } from "@/lib/auth/access";
import { listRoles } from "@/lib/domain/roles";
import { SettingsHeader } from "../settings-header";
import { RolesEditor } from "./roles-editor";

export default async function RolesPage() {
  const access = await getAccess();
  if (!access) return null;
  const roles = await listRoles(access.session.teamId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Roles y accesos"
        description="Define qué módulos puede ver o editar cada rol. Luego asigna el rol a cada persona en Ajustes › Equipo."
      />
      <RolesEditor roles={roles} canEdit={access.isAdmin} />
    </div>
  );
}
