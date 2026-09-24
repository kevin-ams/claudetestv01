import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listRocks, listMilestonesForRocks } from "@/lib/domain/rocks";
import { listTeamMembers } from "@/lib/domain/users";
import { currentQuarter } from "@/lib/utils/dates";
import { RockCard } from "./rock-card";
import { AddRockForm } from "./add-rock-form";

function quarterHref(quarter: number, year: number) {
  return `/rocks?quarter=${quarter}&year=${year}`;
}

function shiftQuarter(quarter: number, year: number, delta: number) {
  let q = quarter + delta;
  let y = year;
  if (q > 4) {
    q = 1;
    y += 1;
  } else if (q < 1) {
    q = 4;
    y -= 1;
  }
  return { quarter: q, year: y };
}

export default async function RocksPage({
  searchParams,
}: {
  searchParams: Promise<{ quarter?: string; year?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const fallback = currentQuarter();
  const quarter = Number(sp.quarter) || fallback.quarter;
  const year = Number(sp.year) || fallback.year;

  const [rocks, members] = await Promise.all([
    listRocks(session.teamId, quarter, year),
    listTeamMembers(session.teamId),
  ]);
  const milestones = await listMilestonesForRocks(rocks.map((r) => r.id));
  const milestonesByRock = new Map<number, typeof milestones>();
  for (const m of milestones) {
    milestonesByRock.set(m.rock_id, [...(milestonesByRock.get(m.rock_id) ?? []), m]);
  }

  const companyRocks = rocks.filter((r) => r.is_company_rock);
  const individualRocks = rocks.filter((r) => !r.is_company_rock);
  const byOwner = new Map<number | null, typeof individualRocks>();
  for (const r of individualRocks) {
    byOwner.set(r.owner_id, [...(byOwner.get(r.owner_id) ?? []), r]);
  }

  const prev = shiftQuarter(quarter, year, -1);
  const next = shiftQuarter(quarter, year, 1);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rocks</h1>
          <p className="text-sm text-muted">
            Prioridades de 90 días: de la empresa y de cada persona.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={quarterHref(prev.quarter, prev.year)} className="eos-btn eos-btn-secondary">
            ← Q{prev.quarter} {prev.year}
          </Link>
          <span className="font-semibold">
            Q{quarter} {year}
          </span>
          <Link href={quarterHref(next.quarter, next.year)} className="eos-btn eos-btn-secondary">
            Q{next.quarter} {next.year} →
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <AddRockForm members={members} quarter={quarter} year={year} />
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Rocks de la empresa
          </h2>
          {companyRocks.length === 0 ? (
            <p className="text-sm text-muted">Sin Rocks de empresa este trimestre.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {companyRocks.map((r) => (
                <RockCard
                  key={r.id}
                  rock={r}
                  milestones={milestonesByRock.get(r.id) ?? []}
                  members={members}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Rocks individuales
          </h2>
          {individualRocks.length === 0 ? (
            <p className="text-sm text-muted">Sin Rocks individuales este trimestre.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {Array.from(byOwner.entries()).map(([ownerId, ownerRocks]) => (
                <div key={ownerId ?? "none"}>
                  <p className="mb-2 text-sm font-semibold">
                    {members.find((m) => m.id === ownerId)?.name ?? "Sin dueño"}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {ownerRocks.map((r) => (
                      <RockCard
                        key={r.id}
                        rock={r}
                        milestones={milestonesByRock.get(r.id) ?? []}
                        members={members}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
