import Link from "next/link";
import { getAccess } from "@/lib/auth/access";
import { aiConfigured, checkBudget, getAiSettings, userQuestionsLast24h } from "@/lib/domain/ai-usage";
import { AssistantChat } from "./assistant-chat";

/** Asistente IA (premium): preguntas en lenguaje natural sobre el EOS y el vault, con los permisos del rol. */
export default async function AsistentePage() {
  const access = await getAccess();
  if (!access) return null;
  const { teamId, userId } = access.session;
  const [settings, used, budget] = await Promise.all([getAiSettings(teamId), userQuestionsLast24h(userId), checkBudget(teamId, userId)]);
  const left = settings ? Math.max(0, settings.userDailyLimit - used) : 0;
  const blocked = budget.ok ? null : budget.message;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Asistente IA</h1>
          <p className="text-sm text-muted">
            Pregunta sobre Rocks, Scorecard, Issues, To-Dos, V/TO, la L10, las carreras y las notas del vault. Responde con tus permisos y cita
            de dónde sale cada dato.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {aiConfigured() && settings && <span>Te quedan {left} de {settings.userDailyLimit} preguntas en 24 h</span>}
          {access.isAdmin && (
            <Link prefetch={false} href="/ajustes/asistente" className="text-primary hover:underline">
              Uso y topes
            </Link>
          )}
        </div>
      </div>
      <AssistantChat blocked={blocked} />
    </div>
  );
}
