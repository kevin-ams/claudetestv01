import { logoutAction } from "@/lib/auth/actions";
import { TeamSwitcher } from "./team-switcher";
import { SidebarToggle } from "./sidebar-toggle";
import { ThemeToggleButton } from "@/components/theme/theme-mode-picker";
import type { SessionPayload } from "@/lib/auth/token";

export function Topbar({
  session,
  teams,
}: {
  session: SessionPayload;
  teams: { id: number; name: string }[];
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur md:px-6">
      <SidebarToggle />
      <div className="flex items-center gap-2">
        {teams.length > 1 && <TeamSwitcher currentTeamId={session.teamId} teams={teams} />}
        <ThemeToggleButton />
        <span className="hidden text-sm text-muted sm:inline">{session.name}</span>
        <form action={logoutAction}>
          <button type="submit" className="eos-btn eos-btn-secondary !px-3 !py-1.5 text-xs">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
