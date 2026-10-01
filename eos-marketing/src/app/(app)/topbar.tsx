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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur md:px-6">
      <SidebarToggle />
      <div className="flex items-center gap-2">
        {teams.length > 1 && <TeamSwitcher currentTeamId={session.teamId} teams={teams} />}
        <ThemeToggleButton />
        <Link
          href="/perfil"
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
