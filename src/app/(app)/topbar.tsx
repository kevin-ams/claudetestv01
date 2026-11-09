import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionPayload } from "@/lib/auth/token";
import { initials } from "@/lib/ui/modules";
import { TeamSwitcher } from "./team-switcher";

export function Topbar({
  session,
  teamName,
  teams,
}: {
  session: SessionPayload;
  teamName: string;
  teams: { id: number; name: string }[];
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-card/75 px-4 backdrop-blur-md md:px-8">
      <div className="ml-12 flex items-center gap-2 md:ml-0">
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" aria-hidden />
        <span className="font-semibold">{teamName}</span>
        {teams.length > 1 && (
          <TeamSwitcher currentTeamId={session.teamId} teams={teams} />
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="avatar h-8 w-8 text-xs" aria-hidden>
            {initials(session.name)}
          </span>
          <span className="hidden text-sm font-medium sm:inline">{session.name}</span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="btn btn-secondary !px-2.5 !py-1.5 text-xs"
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </form>
      </div>
    </header>
  );
}
