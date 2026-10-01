import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { coverageBalances, listCoverages, listOptions } from "@/lib/domain/editorial";
import { listTeamMembers } from "@/lib/domain/users";
import { formatMonth, isMonthISO, monthISO, shiftMonth } from "@/lib/utils/dates";
import { CoverageBoard } from "./coverage-board";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default async function CoberturasPage({ searchParams }: PageProps<"/coberturas">) {
  const session = await getSession();
  if (!session) return null;
  const { mes } = await searchParams;
  const all = mes === "todo";
  const month = isMonthISO(mes) ? mes : monthISO();
  const bounds = all ? { from: null, to: null } : monthBounds(month);

  const [coverages, balances, members, options, editable] = await Promise.all([
    listCoverages(session.teamId, bounds.from, bounds.to),
    coverageBalances(session.teamId),
    listTeamMembers(session.teamId),
    listOptions(session.teamId),
    canEdit("coberturas"),
  ]);

  const nav = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Control de coberturas</h1>
          <p className="text-sm text-muted">
            Registro de coberturas de eventos, paquete asignado y control de horas fuera de horario por reponer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!all && (
            <Link className={nav} href={`/coberturas?mes=${shiftMonth(month, -1)}`} aria-label="Mes anterior">
              ‹
            </Link>
          )}
          <span className="min-w-36 text-center font-semibold capitalize">{all ? "Todo el registro" : formatMonth(month)}</span>
          {!all && (
            <Link className={nav} href={`/coberturas?mes=${shiftMonth(month, 1)}`} aria-label="Mes siguiente">
              ›
            </Link>
          )}
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={all ? "/coberturas" : "/coberturas?mes=todo"}>
            {all ? "Por mes" : "Ver todo"}
          </Link>
        </div>
      </div>
      <CoverageBoard
        coverages={coverages}
        balances={balances}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        options={options}
        currentUserId={session.userId}
        editable={editable}
        defaultDate={all ? undefined : month === monthISO() ? undefined : `${month}-01`}
      />
    </div>
  );
}
