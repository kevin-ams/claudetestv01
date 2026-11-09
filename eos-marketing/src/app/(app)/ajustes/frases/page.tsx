import { getSession } from "@/lib/auth/session";
import { canEdit } from "@/lib/auth/access";
import { listQuotes, quoteOfTheDay } from "@/lib/domain/quotes";
import { QUOTE_CATEGORIES } from "@/lib/domain/quotes-catalog";
import { SettingsHeader } from "../settings-header";
import { QuotesEditor } from "./quotes-editor";

export default async function FrasesPage() {
  const session = await getSession();
  if (!session) return null;
  const [quotes, today, editable] = await Promise.all([
    listQuotes(session.teamId),
    quoteOfTheDay(session.teamId),
    canEdit("ajustes"),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Frases motivacionales"
        description="Cada día el Dashboard muestra una frase distinta de esta lista (solo las activas), sin repetir hasta recorrerlas todas."
      />
      <QuotesEditor quotes={quotes} todayId={today?.id ?? null} categories={QUOTE_CATEGORIES} canEdit={editable} />
    </div>
  );
}
