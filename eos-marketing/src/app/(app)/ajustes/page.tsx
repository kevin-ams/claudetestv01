import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { listTeamMembers } from "@/lib/domain/users";
import { listControlMilestones } from "@/lib/domain/control-milestones";
import { getAnnouncementSettings, listAnnouncementSlots } from "@/lib/domain/announcements";
import { getTeam } from "@/lib/domain/teams";
import { getDemoTeamFor } from "@/lib/domain/demo";
import { THEME_PRESETS } from "@/lib/theme";

const SECTIONS = [
  {
    href: "/ajustes/equipo",
    icon: "👥",
    title: "Equipo",
    description: "Personas con acceso, correos, contraseñas y nombre del equipo.",
  },
  {
    href: "/ajustes/apariencia",
    icon: "🎨",
    title: "Apariencia",
    description: "Modo claro u oscuro y color del template de la plataforma.",
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
    href: "/ajustes/demo",
    icon: "🧪",
    title: "Información demo",
    description: "Ver la plataforma con datos de ejemplo para presentaciones, y desactivarlos.",
  },
  {
    href: "/ajustes/diagnostico",
    icon: "🩺",
    title: "Diagnóstico",
    description: "Revisa si la base de datos y la carpeta de imágenes funcionan, y muestra el error si algo falla.",
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

  const [team, demo, members, milestones, adSettings, slots] = await Promise.all([
    getTeam(session.teamId),
    getDemoTeamFor(session.userId),
    listTeamMembers(session.teamId),
    listControlMilestones(session.teamId),
    getAnnouncementSettings(session.teamId),
    listAnnouncementSlots(session.teamId),
  ]);
  const activeAds = slots.filter((s) => s.has_image && s.active).length;
  const status: Record<string, string> = {
    "/ajustes/equipo": `${members.length} personas`,
    "/ajustes/apariencia": THEME_PRESETS.find((p) => p.color === team?.theme_color)?.name ?? "Color personalizado",
    "/ajustes/hitos": `${milestones.length} hitos`,
    "/ajustes/anuncios": adSettings.enabled
      ? `Activos · ${activeAds} imagen(es) · cada ${adSettings.interval_minutes} min`
      : "Desactivados",
    "/ajustes/exportar": "Scorecard · Indicadores · Metas",
    "/ajustes/diagnostico": "Pruebas de base de datos e imágenes",
    "/ajustes/demo": team?.is_demo ? "Estás viendo la demo" : demo ? "Demo creada" : "Desactivada",
  };

  const STATUS_COLOR: Record<string, "default" | "accent" | "success" | "warning"> = {
    "/ajustes/anuncios": adSettings.enabled ? "success" : "default",
    "/ajustes/demo": team?.is_demo ? "warning" : demo ? "accent" : "default",
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted">Configuración del sistema para tu equipo.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
            <Card className="h-full transition group-hover:shadow-md group-hover:ring-1 group-hover:ring-primary/40">
              <Card.Header className="flex-row items-start gap-3">
                <span className="text-3xl" aria-hidden>
                  {s.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <Card.Title>{s.title}</Card.Title>
                  <Card.Description>{s.description}</Card.Description>
                </span>
              </Card.Header>
              <Card.Footer>
                <Chip size="sm" color={STATUS_COLOR[s.href] ?? "default"} variant="soft">
                  {status[s.href]}
                </Chip>
              </Card.Footer>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
