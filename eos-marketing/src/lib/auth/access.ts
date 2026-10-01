import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession, requireSession } from "./session";
import type { SessionPayload } from "./token";
import { allows, levelFor, MODULES, type AccessLevel, type ModuleKey, type Permissions } from "./modules";

export type Access = {
  session: SessionPayload;
  isAdmin: boolean;
  roleId: number | null;
  roleName: string;
  permissions: Permissions;
  level: (module: ModuleKey) => AccessLevel;
};

/** Error de permisos: la página de error lo muestra con un mensaje claro. */
export class AccessDeniedError extends Error {
  constructor(message = "No tienes permiso para hacer cambios en este módulo.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

async function loadAccess(session: SessionPayload): Promise<Access> {
  const rows = await db().sql`
    SELECT r.id, r.name, r.is_admin, r.permissions
    FROM team_members tm
    LEFT JOIN team_roles r ON r.id = tm.role_id
    WHERE tm.team_id = ${session.teamId} AND tm.user_id = ${session.userId}
  `;
  const row = rows[0] as
    | { id: number | null; name: string | null; is_admin: boolean | null; permissions: Permissions | string | null }
    | undefined;
  const permissions: Permissions =
    typeof row?.permissions === "string" ? JSON.parse(row.permissions) : (row?.permissions ?? {});
  // Sin rol asignado: acceso de usuario con todo editable salvo los ajustes.
  const isAdmin = Boolean(row?.is_admin);
  const effective: Permissions = row?.id ? permissions : { ajustes: "view" };
  return {
    session,
    isAdmin,
    roleId: row?.id ?? null,
    roleName: row?.name ?? "Usuario",
    permissions: effective,
    level: (module) => levelFor(effective, isAdmin, module),
  };
}

/** Acceso de la persona en su equipo actual (una consulta por petición). */
export const getAccess = cache(async (): Promise<Access | null> => {
  const session = await getSession();
  if (!session) return null;
  return loadAccess(session);
});

/** Para páginas: sin acceso al módulo → pantalla de "sin acceso". */
export async function requireModulePage(module: ModuleKey): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  if (access.level(module) === "none") redirect(`/sin-acceso?modulo=${module}`);
  return access;
}

/** Para acciones de servidor: exige el nivel indicado (por defecto, editar). */
export async function requireModule(module: ModuleKey, needed: AccessLevel = "edit"): Promise<SessionPayload> {
  await requireSession();
  const access = await getAccess();
  if (!access || !allows(access.level(module), needed)) throw new AccessDeniedError();
  return access.session;
}

/** Solo administradores del equipo actual. */
export async function requireAdmin(message = "Solo un administrador puede hacer este cambio."): Promise<SessionPayload> {
  await requireSession();
  const access = await getAccess();
  if (!access?.isAdmin) throw new AccessDeniedError(message);
  return access.session;
}

/** ¿Puede editar el módulo? (para decidir qué mostrar en la interfaz). */
export async function canEdit(module: ModuleKey): Promise<boolean> {
  const access = await getAccess();
  return Boolean(access && allows(access.level(module), "edit"));
}

export async function isTeamAdmin(): Promise<boolean> {
  return Boolean((await getAccess())?.isAdmin);
}

/** Primera sección a la que la persona tiene acceso (para redirigir). */
export function firstAllowedPath(access: Access): string {
  return MODULES.find((m) => access.level(m.key) !== "none")?.href ?? "/sin-acceso";
}
