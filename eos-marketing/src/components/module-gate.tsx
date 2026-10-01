import type { ReactNode } from "react";
import { requireModulePage } from "@/lib/auth/access";
import type { ModuleKey } from "@/lib/auth/modules";

/**
 * Protege un módulo según el rol: sin acceso → pantalla "sin acceso";
 * solo ver → aviso y todos los controles deshabilitados.
 */
export async function ModuleGate({
  module,
  lockWhenReadOnly = true,
  children,
}: {
  module: ModuleKey;
  lockWhenReadOnly?: boolean;
  children: ReactNode;
}) {
  const access = await requireModulePage(module);
  if (access.level(module) !== "view" || !lockWhenReadOnly) return <>{children}</>;
  return (
    <>
      <p className="mx-auto mb-4 max-w-6xl rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
        Modo solo lectura: tu rol ({access.roleName}) puede ver este módulo, pero no hacer cambios.
      </p>
      {/* Un fieldset deshabilitado desactiva todos los botones y campos de adentro. */}
      <fieldset disabled className="contents min-w-0">
        {children}
      </fieldset>
    </>
  );
}
