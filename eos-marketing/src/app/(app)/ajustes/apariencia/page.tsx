import { canEdit } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getTeam, teamLogoUrl } from "@/lib/domain/teams";
import { LogoSettings } from "./logo-settings";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";
import { SettingsHeader } from "../settings-header";
import { AppearanceSettings } from "./appearance-settings";

export default async function AparienciaPage() {
  const session = await getSession();
  if (!session) return null;
  const [team, editable] = await Promise.all([getTeam(session.teamId), canEdit("ajustes")]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SettingsHeader
        title="Apariencia"
        description="Logo de la organización, modo claro u oscuro (cada persona elige el suyo) y color del template (para todo el equipo)."
      />
      <LogoSettings logoUrl={teamLogoUrl(team)} teamName={team?.name ?? "Equipo"} canEdit={editable} />
      <AppearanceSettings color={team?.theme_color ?? DEFAULT_THEME_COLOR} canEdit={editable} />
    </div>
  );
}
