import { getDashboardData, STALE_DAYS, type MoneyByCurrency } from "@/lib/domain/dashboard";
import { defaultPipelineId } from "@/lib/domain/pipeline";
import { formatMoney } from "@/lib/money";

function MoneyLines({ value }: { value: MoneyByCurrency }) {
  return (
    <>
      <p className="text-2xl font-bold tracking-tight">{formatMoney(value.GTQ, "GTQ")}</p>
      {value.USD > 0 && (
        <p className="text-sm font-semibold text-muted">+ {formatMoney(value.USD, "USD")}</p>
      )}
    </>
  );
}

function Kpi({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData(await defaultPipelineId());
  const maxDeals = Math.max(1, ...data.funnel.map((f) => f.deals));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">Resumen del pipeline de Ams Studio</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pipeline abierto" hint={`${data.openDeals} negocios abiertos`}>
          <MoneyLines value={data.openValue} />
        </Kpi>
        <Kpi label="Pronóstico ponderado" hint="Monto × probabilidad de la etapa">
          <MoneyLines value={data.weightedValue} />
        </Kpi>
        <Kpi label="Ganado este mes">
          <MoneyLines value={data.wonThisMonth} />
        </Kpi>
        <Kpi label="Contactos" hint={`${data.companies} empresas`}>
          <p className="text-2xl font-bold tracking-tight">{data.contacts}</p>
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Embudo por etapa</h2>
          <div className="mt-4 space-y-3">
            {data.funnel.map((f) => (
              <div key={f.stage} className="grid grid-cols-[10rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate font-medium">{f.stage}</span>
                <div className="h-2.5 rounded-full bg-brand-tint">
                  <div
                    className={`h-2.5 rounded-full ${
                      f.kind === "won" ? "bg-green" : f.kind === "lost" ? "bg-muted/50" : "bg-brand"
                    }`}
                    style={{ width: `${(f.deals / maxDeals) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-muted">{f.deals}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Requieren atención</h2>
          <p className="mt-4 text-3xl font-bold">{data.staleDeals}</p>
          <p className="text-sm text-muted">
            negocios abiertos sin actividad en {STALE_DAYS} días
          </p>
        </div>
      </div>
    </div>
  );
}
