import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { getUserTeams, isUserInTeam } from "@/lib/domain/users";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { activeAnnouncements } from "@/lib/domain/announcements";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { stopDemoAction } from "./ajustes/demo/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  // La sesión puede venir de una base de datos anterior (otra copia de la app
  // o una base reiniciada): si el usuario ya no está en ese equipo, se cierra.
  if (!(await isUserInTeam(session.userId, session.teamId))) redirect("/salir");

  const [team, teams, announcements] = await Promise.all([
    getTeam(session.teamId),
    getUserTeams(session.userId),
    activeAnnouncements(session.teamId),
  ]);

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <Topbar
          session={session}
          teamName={team?.name ?? "Equipo"}
          teams={teams}
        />
        {team?.is_demo && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-yellow/30 bg-yellow-bg px-4 py-2 text-sm text-yellow md:px-8">
            <span>
              <b>Modo demo:</b> estás viendo información de ejemplo. Nada de lo que hagas aquí afecta tus datos reales.
            </span>
            <form action={stopDemoAction}>
              <button type="submit" className="rounded-md bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                Desactivar demo y volver
              </button>
            </form>
          </div>
        )}
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        {announcements.ads.length > 0 && (
          <AnnouncementPopup
            teamId={session.teamId}
            ads={announcements.ads}
            intervalMinutes={announcements.intervalMinutes}
          />
        )}
      </div>
    </div>
  );
}
