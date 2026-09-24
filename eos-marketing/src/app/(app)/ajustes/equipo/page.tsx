import { getSession } from "@/lib/auth/session";
import { listTeamMembersDetailed } from "@/lib/domain/users";
import { getTeam } from "@/lib/domain/teams";
import { AddTeammateForm } from "./add-teammate-form";
import { renameTeamAction } from "./actions";
import { EditAccessForm } from "./edit-access-form";
import { SettingsHeader } from "../settings-header";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [team, members] = await Promise.all([
    getTeam(session.teamId),
    listTeamMembersDetailed(session.teamId),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <SettingsHeader title="Equipo" description={`Administra quién tiene acceso a ${team?.name ?? "tu equipo"}.`} />
      </div>

      {session.role === "admin" && (
        <form action={renameTeamAction} className="card mb-6 flex items-center gap-2 p-4">
          <input
            name="name"
            defaultValue={team?.name}
            className="input flex-1"
            placeholder="Nombre del equipo"
          />
          <button type="submit" className="btn btn-secondary">
            Guardar
          </button>
        </form>
      )}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Miembros ({members.length})
        </h2>
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
                {session.role === "admin" && m.id !== session.userId && (
                  <EditAccessForm userId={m.id} name={m.name} email={m.email} />
                )}
                <span className="badge bg-background text-muted">
                  {m.role === "admin" ? "Admin" : "Miembro"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {session.role === "admin" ? (
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Agregar persona
          </h2>
          <AddTeammateForm />
        </div>
      ) : (
        <p className="text-sm text-muted">
          Solo un administrador puede agregar nuevas personas al equipo.
        </p>
      )}
    </div>
  );
}
