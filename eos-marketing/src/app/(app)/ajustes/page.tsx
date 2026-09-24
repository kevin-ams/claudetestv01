import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listTeamMembers } from "@/lib/domain/users";
import { listControlMilestones } from "@/lib/domain/control-milestones";
import { getAnnouncementSettings, listAnnouncementSlots } from "@/lib/domain/announcements";

const SECTIONS = [
  {
    href: "/ajustes/equipo",
    icon: "👥",
    title: "Equipo",
    description: "Personas con acceso, correos, contraseñas y nombre del equipo.",
  },
  {
    href: "/ajustes/hitos",
    icon: "🗺️",
    title: "Hitos de Control de carrera",
    description: "Editar, renombrar, eliminar, agregar y reordenar hitos; duración y dependencias.",
  },
  {
    href: "/ajustes/anuncios",
    icon: "📢",
    title: "Anuncios",
    description: "Hasta 5 imágenes que aparecen como popup cada cierto tiempo. Activar o desactivar.",
  },
  {
    href: "/ajustes/exportar",
    icon: "📤",
    title: "Exportar datos",
    description: "Descargar Scorecard e Indicadores de carrera en Excel (.xlsm o .xlsx).",
  },
] as const;

export default async function AjustesIndexPage() {
  const session = await getSession();
  if (!session) return null;

  const [members, milestones, adSettings, slots] = await Promise.all([
    listTeamMembers(session.teamId),
    listControlMilestones(session.teamId),
    getAnnouncementSettings(session.teamId),
    listAnnouncementSlots(session.teamId),
  ]);
  const activeAds = slots.filter((s) => s.has_image && s.active).length;
  const status: Record<string, string> = {
    "/ajustes/equipo": `${members.length} personas`,
    "/ajustes/hitos": `${milestones.length} hitos`,
    "/ajustes/anuncios": adSettings.enabled
      ? `Activos · ${activeAds} imagen(es) · cada ${adSettings.interval_minutes} min`
      : "Desactivados",
    "/ajustes/exportar": "Scorecard · Indicadores · Metas",
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted">Configuración del sistema para tu equipo.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card flex gap-4 p-5 transition hover:border-primary">
            <span className="text-3xl" aria-hidden>
              {s.icon}
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{s.title}</span>
              <span className="text-sm text-muted">{s.description}</span>
              <span className="text-xs font-semibold text-primary">{status[s.href]}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
