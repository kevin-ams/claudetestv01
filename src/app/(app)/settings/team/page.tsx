import { getSession } from "@/lib/auth/session";
import { listTeamMembersDetailed } from "@/lib/domain/users";
import { getTeam } from "@/lib/domain/teams";
import { AddTeammateForm } from "./add-teammate-form";
import { renameTeamAction } from "./actions";
import { initials } from "@/lib/ui/modules";
import { PageHeader } from "@/components/page-header";

const AVATAR_TONES = ["tone-dashboard", "tone-scorecard", "tone-rocks", "tone-issues", "tone-accountability", "tone-meeting"];

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [team, members] = await Promise.all([
    getTeam(session.teamId),
    listTeamMembersDetailed(session.teamId),
  ]);

  return (
    <div className="tone-team mx-auto max-w-2xl">
      <PageHeader
        module="team"
        title="Equipo"
        description={`Administra quién tiene acceso a ${team?.name ?? "tu equipo"}.`}
      />

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
        <ul className="stagger flex flex-col gap-1">
          {members.map((m, i) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg p-2 text-sm transition-colors hover:bg-background"
            >
              <div className="flex items-center gap-3">
                <span className={`${AVATAR_TONES[i % AVATAR_TONES.length]} avatar h-9 w-9 text-xs`} aria-hidden>
                  {initials(m.name)}
                </span>
                <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted">
                  {m.email}
                  {m.seat_title && ` · ${m.seat_title}`}
                </p>
                </div>
              </div>
              <span className={`badge ${m.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-background text-muted"}`}>
                {m.role === "admin" ? "Admin" : "Miembro"}
              </span>
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
