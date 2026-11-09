import { Button } from "@heroui/react";
import { logoutAction } from "@/lib/auth/actions";
import { TeamSwitcher } from "./team-switcher";
import { SidebarToggle } from "./sidebar-toggle";
import { ThemeToggleButton } from "@/components/theme/theme-mode-picker";
import type { SessionPayload } from "@/lib/auth/token";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";

export function Topbar({
  session,
  teams,
  avatar,
}: {
  session: SessionPayload;
  teams: { id: number; name: string }[];
  avatar: { src: string | null; color: string } | null;
}) {
  return (
    <header className="glass sticky top-2 z-20 mx-2 mt-2 flex h-14 items-center justify-between gap-2 rounded-2xl px-1.5 md:top-3 md:ml-3 md:mr-4 md:mt-3 md:gap-3 md:px-3">
      <SidebarToggle />
      <div className="flex items-center gap-2">
        {teams.length > 1 && <TeamSwitcher currentTeamId={session.teamId} teams={teams} />}
        <ThemeToggleButton />
        <Link
          href="/perfil"
          prefetch={false}
          className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-sm text-muted hover:bg-default hover:text-foreground"
          title="Mi perfil"
        >
          <UserAvatar name={session.name} src={avatar?.src ?? null} color={avatar?.color || undefined} />
          <span className="hidden sm:inline">{session.name}</span>
        </Link>
        <form action={logoutAction}>
          <Button variant="outline" size="sm" type="submit">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
