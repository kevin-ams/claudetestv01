import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listRocks, listMilestonesForRocks } from "@/lib/domain/rocks";
import { listTeamMembers } from "@/lib/domain/users";
import { currentQuarter } from "@/lib/utils/dates";
import { initials } from "@/lib/ui/modules";
import { RockCard } from "./rock-card";
import { AddRockForm } from "./add-rock-form";
import { PageHeader, SectionTitle } from "@/components/page-header";

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
    <div className="tone-rocks mx-auto max-w-5xl">
      <PageHeader
        module="rocks"
        title="Rocks"
        description="Prioridades de 90 días: de la empresa y de cada persona."
        actions={
          <>
            <Link href={quarterHref(prev.quarter, prev.year)} className="btn btn-secondary">
              ← Q{prev.quarter} {prev.year}
            </Link>
            <span className="bg-tone rounded-full px-3 py-1 text-sm font-bold text-white shadow-sm">
              Q{quarter} {year}
            </span>
            <Link href={quarterHref(next.quarter, next.year)} className="btn btn-secondary">
              Q{next.quarter} {next.year} →
            </Link>
          </>
        }
      />

      {rocks.length > 0 && (
        <div className="stagger mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Completados", n: rocks.filter((r) => r.status === "done").length, tone: "tone-green" },
            { label: "On track", n: rocks.filter((r) => r.status === "on_track").length, tone: "tone-accountability" },
            { label: "Off track", n: rocks.filter((r) => r.status === "off_track").length, tone: "tone-red" },
          ].map((s) => (
            <div key={s.label} className={`${s.tone} tile p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
              <p className="text-tone mt-1 text-3xl font-extrabold">{s.n}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6">
        <AddRockForm members={members} quarter={quarter} year={year} />
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <SectionTitle count={companyRocks.length}>Rocks de la empresa</SectionTitle>
          {companyRocks.length === 0 ? (
            <p className="text-sm text-muted">Sin Rocks de empresa este trimestre.</p>
          ) : (
            <div className="stagger grid gap-3 md:grid-cols-2">
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
          <SectionTitle count={individualRocks.length}>Rocks individuales</SectionTitle>
          {individualRocks.length === 0 ? (
            <p className="text-sm text-muted">Sin Rocks individuales este trimestre.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {Array.from(byOwner.entries()).map(([ownerId, ownerRocks]) => (
                <div key={ownerId ?? "none"}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="avatar h-6 w-6 text-[10px]" aria-hidden>
                      {initials(members.find((m) => m.id === ownerId)?.name ?? "?")}
                    </span>
                    {members.find((m) => m.id === ownerId)?.name ?? "Sin dueño"}
                  </p>
                  <div className="stagger grid gap-3 md:grid-cols-2">
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
