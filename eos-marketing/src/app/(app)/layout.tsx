import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { getUserTeams, isUserInTeam } from "@/lib/domain/users";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  // La sesión puede venir de una base de datos anterior (otra copia de la app
  // o una base reiniciada): si el usuario ya no está en ese equipo, se cierra.
  if (!(await isUserInTeam(session.userId, session.teamId))) redirect("/salir");

  const [team, teams] = await Promise.all([
    getTeam(session.teamId),
    getUserTeams(session.userId),
  ]);

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-64">
        <Topbar
          session={session}
          teamName={team?.name ?? "Equipo"}
          teams={teams}
        />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
