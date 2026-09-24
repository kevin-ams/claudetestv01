import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";
import { SettingsHeader } from "../settings-header";
import { AppearanceSettings } from "./appearance-settings";

export default async function AparienciaPage() {
  const session = await getSession();
  if (!session) return null;
  const team = await getTeam(session.teamId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SettingsHeader
        title="Apariencia"
        description="Modo claro u oscuro (cada persona elige el suyo) y color del template (para todo el equipo)."
      />
      <AppearanceSettings
        color={team?.theme_color ?? DEFAULT_THEME_COLOR}
        canEdit={session.role === "admin"}
      />
    </div>
  );
}
