import { Card, Chip } from "@heroui/react";
import { getAccess } from "@/lib/auth/access";
import { MODULES } from "@/lib/auth/modules";
import { listActivity } from "@/lib/domain/activity";
import { listTeamMembers } from "@/lib/domain/users";
import { SettingsHeader } from "../settings-header";
import { LogFilters } from "./log-filters";

const EXTRA_LABELS: Record<string, string> = { equipo: "Equipo", roles: "Roles y accesos", equipos: "Equipos", ajustes: "Ajustes" };
const LOG_MODULES = [
  ...MODULES.filter((m) => m.key !== "ajustes" && m.key !== "dashboard").map((m) => ({ key: m.key as string, label: m.label })),
  ...Object.entries(EXTRA_LABELS).map(([key, label]) => ({ key, label })),
];
const labelFor = (key: string) => LOG_MODULES.find((m) => m.key === key)?.label ?? key;

const WHEN = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: process.env.EOS_TIMEZONE || "America/Guatemala",
});

export default async function LogPage({ searchParams }: PageProps<"/ajustes/log">) {
  const access = await getAccess();
  if (!access) return null;
  const { modulo, persona } = await searchParams;
  const moduleFilter = typeof modulo === "string" && modulo ? modulo : undefined;
  const userFilter = typeof persona === "string" && persona ? Number(persona) : undefined;

  if (!access.isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <SettingsHeader title="Log" description="Bitácora de acciones importantes del equipo." />
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">Solo un administrador puede ver el log.</p>
      </div>
    );
  }

  const [entries, members] = await Promise.all([
    listActivity(access.session.teamId, { module: moduleFilter, userId: userFilter, limit: 300 }),
    listTeamMembers(access.session.teamId),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SettingsHeader
        title="Log"
        description="Bitácora de acciones importantes: metas, indicadores, hitos, Rocks, To-Dos, Issues, reuniones, personas y roles. Se muestran las 300 más recientes."
      />
      <LogFilters
        modules={LOG_MODULES}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        module={moduleFilter ?? ""}
        person={userFilter ? String(userFilter) : ""}
      />
      <Card className="block gap-0 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Fecha</th>
              <th className="px-2">Persona</th>
              <th className="px-2">Módulo</th>
              <th className="px-2">Acción</th>
              <th className="px-2 pr-4">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Todavía no hay acciones registradas{moduleFilter || userFilter ? " con este filtro" : ""}.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{WHEN.format(new Date(e.created_at))}</td>
                <td className="whitespace-nowrap px-2 py-2 font-medium">{e.user_name || "—"}</td>
                <td className="px-2 py-2">
                  <Chip size="sm" variant="soft">
                    {labelFor(e.module)}
                  </Chip>
                </td>
                <td className="px-2 py-2">{e.action}</td>
                <td className="px-2 py-2 pr-4 text-muted">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
