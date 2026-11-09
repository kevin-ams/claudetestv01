import { logoutAction, switchTeamAction } from "@/lib/auth/actions";
import type { SessionPayload } from "@/lib/auth/token";

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
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-8">
      <div className="ml-10 flex items-center gap-2 md:ml-0">
        <span className="font-semibold">{teamName}</span>
        {teams.length > 1 && (
          <form
            action={async (fd) => {
              "use server";
              await switchTeamAction(Number(fd.get("teamId")));
            }}
          >
            <select
              name="teamId"
              defaultValue={session.teamId}
              className="input ml-2 !w-auto text-xs"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </form>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">
          {session.name}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-secondary !px-3 !py-1.5 text-xs">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
