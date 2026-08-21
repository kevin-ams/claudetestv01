import { getSession } from "@/lib/auth/session";
import { listSeats } from "@/lib/domain/accountability";
import { listTeamMembers } from "@/lib/domain/users";
import { SeatTree } from "./seat-tree";

export default async function AccountabilityPage() {
  const session = await getSession();
  if (!session) return null;

  const [seats, members] = await Promise.all([
    listSeats(session.teamId),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Organigrama de Responsabilidad</h1>
        <p className="text-sm text-muted">
          Quién es dueño de qué. Cada asiento tiene una persona y de 3 a 5
          roles/responsabilidades claras.
        </p>
      </div>
      <SeatTree seats={seats} members={members} />
    </div>
  );
}
