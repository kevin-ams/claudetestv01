import { getSession } from "@/lib/auth/session";
import { listCareers } from "@/lib/domain/careers";
import { listTracks } from "@/lib/domain/career-tracks";
import { listTeamMembers } from "@/lib/domain/users";
import { ControlBoard } from "./control-board";

export default async function ControlPage() {
  const session = await getSession();
  if (!session) return null;

  const [tracks, careers, members] = await Promise.all([
    listTracks(session.teamId),
    listCareers(session.teamId),
    listTeamMembers(session.teamId),
  ]);
  const tracked = new Set(tracks.map((t) => t.career_id));

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Control de carrera</h1>
        <p className="text-sm text-muted">
          Avance del lanzamiento de cada carrera por hitos: arrastra las tarjetas entre columnas,
          revisa la ruta crítica y marca si van on track u off track.
        </p>
      </div>
      <ControlBoard
        tracks={tracks}
        members={members}
        available={careers
          .filter((c) => !tracked.has(c.id))
          .map((c) => ({ id: c.id, code: c.code, name: c.name, program: c.program, owner_id: c.owner_id }))}
      />
    </div>
  );
}
