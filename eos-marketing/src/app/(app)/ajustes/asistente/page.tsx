import { Card } from "@heroui/react";
import { getAccess } from "@/lib/auth/access";
import { isPlatformOwner } from "@/lib/auth/platform";
import { AI_MODELS, aiConfigured, getAiSettings, globalMonthlyCap, globalMonthSpend, usageSummary, usd } from "@/lib/domain/ai-usage";
import { SettingsHeader } from "../settings-header";
import { AiSettingsForm } from "./settings-form";

/** Panel de uso del Asistente IA: consumo del mes contra el tope, por persona y por día. */
export default async function AsistenteSettingsPage() {
  const access = await getAccess();
  if (!access) return null;
  if (!access.isAdmin) {
    return <p className="mx-auto max-w-4xl text-sm text-muted">Solo los administradores ven el consumo del asistente.</p>;
  }
  const settings = await getAiSettings(access.session.teamId);
  if (!settings) return null;
  const [summary, owner, global] = await Promise.all([
    usageSummary(settings.organizationId, settings.monthlyCapUsd),
    isPlatformOwner(access.session.userId),
    globalMonthSpend(),
  ]);
  const pct = settings.monthlyCapUsd > 0 ? Math.min(100, (summary.spent / settings.monthlyCapUsd) * 100) : 100;
  const barColor = pct >= 90 ? "bg-red" : pct >= 70 ? "bg-yellow" : "bg-primary";
  const perQuestion = summary.questions ? summary.spent / summary.questions : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SettingsHeader
        title="Asistente IA"
        description="El asistente responde preguntas sobre el EOS y el vault con los permisos de cada rol. Cada respuesta tiene un costo en la cuenta de Anthropic; aquí se ve el consumo del mes y sus topes."
      />

      {!aiConfigured() && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Sin configurar: falta la variable <code>ANTHROPIC_API_KEY</code> en Netlify (Project configuration › Environment variables). La crea el dueño
          de la plataforma con una clave de console.anthropic.com y se activa en el siguiente deploy.
        </p>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Consumo de este mes</h2>
          <span className="text-sm tabular-nums text-muted">
            {usd(summary.spent)} de {usd(settings.monthlyCapUsd)}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-default" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Consumo del tope mensual">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Preguntas" value={String(summary.questions)} />
          <Stat label="Desde la caché (gratis)" value={String(summary.cachedAnswers)} />
          <Stat label="Costo promedio" value={summary.questions ? usd(perQuestion) : "—"} />
          <Stat label="Preguntas que alcanzan" value={perQuestion ? `~${Math.max(0, Math.floor((settings.monthlyCapUsd - summary.spent) / perQuestion))}` : "—"} />
        </dl>
        {owner && (
          <p className="text-xs text-muted">
            Toda la plataforma: {usd(global)} de {usd(globalMonthlyCap())} este mes (tope global, variable AI_GLOBAL_MONTHLY_CAP_USD).
          </p>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Por persona</h2>
          {summary.byUser.length === 0 ? (
            <p className="text-sm text-muted">Nadie ha usado el asistente este mes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Persona</th>
                  <th className="pb-2 text-right font-medium">Preguntas</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {summary.byUser.map((u) => (
                  <tr key={u.userId ?? "x"} className="border-t border-border">
                    <td className="py-1.5">{u.name}</td>
                    <td className="py-1.5 text-right">{u.questions}</td>
                    <td className="py-1.5 text-right">{usd(u.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Por día</h2>
          {summary.byDay.length === 0 ? (
            <p className="text-sm text-muted">Sin consumo este mes.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm tabular-nums">
              {summary.byDay.map((d) => {
                const max = Math.max(...summary.byDay.map((x) => x.cost), 0.0001);
                return (
                  <li key={d.day} className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-2">
                    <span className="text-xs text-muted">{d.day.slice(5)}</span>
                    <span className="h-2 rounded-full bg-primary/70" style={{ width: `${Math.max(2, (d.cost / max) * 100)}%` }} />
                    <span className="text-right text-xs">{usd(d.cost)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Topes y modelo</h2>
        <p className="mb-4 text-sm text-muted">
          {owner
            ? "Al llegar al tope mensual el asistente se pausa hasta el día 1. El límite por persona cuenta las preguntas de las últimas 24 horas."
            : "Solo el dueño de la plataforma cambia estos valores."}
        </p>
        <AiSettingsForm
          canEdit={owner}
          initial={{ monthlyCapUsd: settings.monthlyCapUsd, userDailyLimit: settings.userDailyLimit, model: settings.model }}
          models={Object.entries(AI_MODELS).map(([id, m]) => ({ id, label: `${m.label} · $${m.input} / $${m.output} por millón de tokens` }))}
        />
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
