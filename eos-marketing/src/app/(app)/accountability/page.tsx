import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listOrgMembers, listSeats } from "@/lib/domain/accountability";
import { avatarUrl, teamProfiles, type Profile } from "@/lib/domain/profile";
import { orgTeamIds } from "@/lib/domain/teams";
import { SeatTree, type OrgPerson } from "./seat-tree";

export default async function AccountabilityPage() {
  const session = await getSession();
  if (!session) return null;

  const [seats, members, editable, teams] = await Promise.all([
    listSeats(session.teamId),
    listOrgMembers(session.teamId),
    canEdit("accountability"),
    orgTeamIds(session.teamId),
  ]);
  const profiles: Record<number, Profile> = Object.assign({}, ...(await Promise.all(teams.map((t) => teamProfiles(t)))));
  const people: OrgPerson[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: profiles[m.id] ? avatarUrl(profiles[m.id]) : null,
    color: profiles[m.id]?.color ?? undefined,
  }));

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Organigrama de responsabilidades</h1>
        <p className="text-sm text-muted">
          Uno solo para toda la organización (todos los equipos ven el mismo). Muestra las funciones, quién las ocupa y sus
          roles: cada puesto es una función con unos 5 roles y reporta a un solo puesto.
        </p>
      </div>
      <SeatTree seats={seats} people={people} editable={editable} />
    </div>
  );
}
