import { getSession } from "@/lib/auth/session";
import { listCareers, listMonthlyGoals } from "@/lib/domain/careers";
import { listTeamMembers } from "@/lib/domain/users";
import { GoalsGrid } from "./goals-grid";

function monthsOf(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const year = Number(sp.anio) || new Date().getFullYear();
  const months = monthsOf(year);

  const [careers, goals, members] = await Promise.all([
    listCareers(session.teamId),
    listMonthlyGoals(session.teamId, months),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Metas de carrera</h1>
        <p className="text-sm text-muted">
          Meta mensual de leads y presupuesto por carrera. La meta de cada semana en Indicadores se
          calcula desde aquí, proporcional a los días de la semana que caen en cada mes.
        </p>
      </div>
      {careers.length === 0 ? (
        <p className="card card--default block gap-0 p-6 text-sm text-muted">Todavía no hay carreras. Agrégalas en Indicadores de carrera.</p>
      ) : (
        <GoalsGrid year={year} months={months} careers={careers} goals={goals} members={members} />
      )}
    </div>
  );
}
