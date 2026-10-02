import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listBank, listKeyDates, listOptions, listPieces, pieceWeekRange } from "@/lib/domain/editorial";
import { listTeamMembers } from "@/lib/domain/users";
import { getTeam } from "@/lib/domain/teams";
import {
  addDaysISO,
  formatMonth,
  isMonthISO,
  mondaysOfMonth,
  monthISO,
  shiftMonth,
} from "@/lib/utils/dates";
import { CalendarBoard } from "./calendar-board";

export default async function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  const session = await getSession();
  if (!session) return null;
  const { mes } = await searchParams;
  const month = isMonthISO(mes) ? mes : monthISO();
  const weeks = mondaysOfMonth(month);
  const from = weeks[0];
  const to = weeks[weeks.length - 1];

  const [pieces, bank, keyDates, members, options, editable, range] = await Promise.all([
    listPieces(session.teamId, from, to),
    listBank(session.teamId),
    listKeyDates(session.teamId, from, addDaysISO(to, 6)),
    listTeamMembers(session.teamId),
    listOptions(session.teamId),
    canEdit("calendario"),
    pieceWeekRange(session.teamId),
  ]);
  const team = await getTeam(session.teamId);

  const nav = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario editorial</h1>
          <p className="text-sm text-muted">
            Plan de contenido por semana: ~7 piezas planificadas + 3 slots de buffer esporádico. Mezcla Hero · Hub · Hygiene
            y pilares.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className={nav} href={`/calendario?mes=${shiftMonth(month, -1)}`} aria-label="Mes anterior">
            ‹
          </Link>
          <span className="min-w-36 text-center font-semibold capitalize">{formatMonth(month)}</span>
          <Link className={nav} href={`/calendario?mes=${shiftMonth(month, 1)}`} aria-label="Mes siguiente">
            ›
          </Link>
          {month !== monthISO() && (
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/calendario">
              Hoy
            </Link>
          )}
        </div>
      </div>
      {pieces.length === 0 && range.min && (
        <p className="text-sm text-muted">
          No hay piezas en este mes. El calendario tiene piezas del{" "}
          <Link className="text-primary underline" href={`/calendario?mes=${range.min.slice(0, 7)}`}>
            {range.min}
          </Link>{" "}
          al{" "}
          <Link className="text-primary underline" href={`/calendario?mes=${range.max!.slice(0, 7)}`}>
            {range.max}
          </Link>
          .
        </p>
      )}
      <CalendarBoard
        weeks={weeks}
        pieces={pieces}
        bank={bank}
        keyDates={keyDates}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        options={options}
        currentUserId={session.userId}
        editable={editable}
        planningRecipients={team?.planning_recipients ?? ""}
      />
    </div>
  );
}
