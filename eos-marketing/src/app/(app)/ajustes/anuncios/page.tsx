import { getSession } from "@/lib/auth/session";
import { getAnnouncementSettings, listAnnouncementSlots } from "@/lib/domain/announcements";
import { SettingsHeader } from "../settings-header";
import { AdSettings } from "./ad-settings";

export default async function AnunciosPage() {
  const session = await getSession();
  if (!session) return null;
  const [settings, slots] = await Promise.all([
    getAnnouncementSettings(session.teamId),
    listAnnouncementSlots(session.teamId),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Anuncios"
        description="Sube hasta 5 imágenes. Aparecen como popup para todo el equipo, una a la vez y en orden, cada cierto tiempo."
      />
      <AdSettings settings={settings} slots={slots} canEdit={session.role === "admin"} />
    </div>
  );
}
