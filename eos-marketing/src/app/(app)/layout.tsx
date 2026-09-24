import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { getUserTeams, isUserInTeam } from "@/lib/domain/users";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { activeAnnouncements } from "@/lib/domain/announcements";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { DemoBanner } from "./demo-banner";
import { AppShell } from "./shell";
import { countOpenIssues } from "@/lib/domain/issues";
import { countOpenTodos } from "@/lib/domain/todos";
import { brandStyleSheet, DEFAULT_THEME_COLOR, SIDEBAR_COOKIE } from "@/lib/theme";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  // La sesión puede venir de una base de datos anterior (otra copia de la app
  // o una base reiniciada): si el usuario ya no está en ese equipo, se cierra.
  if (!(await isUserInTeam(session.userId, session.teamId))) redirect("/salir");

  const [team, teams, announcements, openTodos, openIssues, cookieStore] = await Promise.all([
    getTeam(session.teamId),
    getUserTeams(session.userId),
    activeAnnouncements(session.teamId),
    countOpenTodos(session.teamId),
    countOpenIssues(session.teamId),
    cookies(),
  ]);

  return (
    <AppShell initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}>
      {/* Color del template del equipo (Ajustes > Apariencia). */}
      <style>{brandStyleSheet(team?.theme_color ?? DEFAULT_THEME_COLOR)}</style>
      <Sidebar teamName={team?.name ?? "Equipo"} counts={{ todos: openTodos, issues: openIssues }} />
      <div className="flex min-w-0 flex-1 flex-col transition-[padding] duration-200 md:pl-64 md:group-data-[collapsed=true]/shell:pl-16">
        <Topbar session={session} teams={teams} />
        {team?.is_demo && <DemoBanner />}
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        {announcements.ads.length > 0 && (
          <AnnouncementPopup
            teamId={session.teamId}
            ads={announcements.ads}
            intervalMinutes={announcements.intervalMinutes}
          />
        )}
      </div>
    </AppShell>
  );
}
