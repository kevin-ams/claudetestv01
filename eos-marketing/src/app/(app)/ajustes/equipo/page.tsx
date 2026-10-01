import { Button, Card, Chip, Input } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { isTeamAdmin } from "@/lib/auth/access";
import { listRoles } from "@/lib/domain/roles";
import { MemberControls } from "./member-controls";
import Link from "next/link";
import { listTeamMembersDetailed } from "@/lib/domain/users";
import { getTeam } from "@/lib/domain/teams";
import { AddTeammateForm } from "./add-teammate-form";
import { renameTeamAction } from "./actions";
import { EditAccessForm } from "./edit-access-form";
import { SettingsHeader } from "../settings-header";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [team, members, roles, admin] = await Promise.all([
    getTeam(session.teamId),
    listTeamMembersDetailed(session.teamId),
    listRoles(session.teamId),
    isTeamAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <SettingsHeader title="Equipo" description={`Administra quién tiene acceso a ${team?.name ?? "tu equipo"}.`} />
      </div>

      {admin && (
        <form action={renameTeamAction} className="card card--default mb-6 flex flex-row items-center gap-2 p-4">
          <Input fullWidth
            name="name"
            defaultValue={team?.name}
            className="flex-1"
            placeholder="Nombre del equipo"
          />
          <Button variant="outline" type="submit">
            Guardar
          </Button>
        </form>
      )}

      <Card className="block gap-0 mb-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Miembros ({members.length})</h2>
          <Link href="/ajustes/roles" className="text-sm text-primary underline">
            Configurar roles y accesos
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted">
                  {m.email}
                  {m.seat_title && ` · ${m.seat_title}`}
                </p>
                {m.email.endsWith("@marketing.local") && (
                  <p className="text-xs text-yellow">Sin acceso todavía: asigna su correo y contraseña.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {admin && m.id !== session.userId && (
                  <EditAccessForm userId={m.id} name={m.name} email={m.email} />
                )}
                {admin ? (
                  <MemberControls
                    userId={m.id}
                    name={m.name}
                    roleId={m.role_id}
                    roles={roles.map((r) => ({ id: r.id, name: r.name }))}
                    isSelf={m.id === session.userId}
                  />
                ) : (
                  <Chip size="sm" variant="soft" color={m.is_admin ? "accent" : "default"}>
                    {m.role_name ?? "Usuario"}
                  </Chip>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {admin ? (
        <Card className="block gap-0 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Agregar persona
          </h2>
          <AddTeammateForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} />
        </Card>
      ) : (
        <p className="text-sm text-muted">
          Solo un administrador puede agregar nuevas personas al equipo.
        </p>
      )}
    </div>
  );
}
