import { getSession } from "@/lib/auth/session";
import { listSeats } from "@/lib/domain/accountability";
import { listTeamMembers } from "@/lib/domain/users";
import { SeatTree } from "./seat-tree";
import { PageHeader } from "@/components/page-header";

export default async function AccountabilityPage() {
  const session = await getSession();
  if (!session) return null;

  const [seats, members] = await Promise.all([
    listSeats(session.teamId),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="tone-accountability mx-auto max-w-6xl">
      <PageHeader
        module="accountability"
        title="Organigrama de Responsabilidad"
        description="Quién es dueño de qué. Cada asiento tiene una persona y de 3 a 5 roles/responsabilidades claras."
      />
      <SeatTree seats={seats} members={members} />
    </div>
  );
}
