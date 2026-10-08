import { getAccess } from "@/lib/auth/access";
import { listTools } from "@/lib/domain/tools";
import { listRoles } from "@/lib/domain/roles";
import { listTeamMembers } from "@/lib/domain/users";
import { SettingsHeader } from "../settings-header";
import { ToolsManager } from "./tools-manager";

export default async function ToolsSettingsPage() {
  const access = await getAccess();
  if (!access) return null;
  const header = (
    <SettingsHeader
      title="Caja de herramientas"
      description="Accesos directos a otros sitios (se abren en una pestaña nueva) o mini módulos con el sitio insertado dentro de la app. Se ven en “Otras herramientas” según quién tenga acceso."
    />
  );
  if (!access.isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {header}
        <p className="card card--default p-6 text-sm text-muted">Solo un administrador puede administrar la caja de herramientas.</p>
      </div>
    );
  }
  const [tools, roles, members] = await Promise.all([
    listTools(access.session.teamId),
    listRoles(access.session.teamId),
    listTeamMembers(access.session.teamId),
  ]);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {header}
      <ToolsManager
        tools={tools}
        roles={roles.map((r) => ({ id: r.id, name: r.name, isAdmin: r.is_admin }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
