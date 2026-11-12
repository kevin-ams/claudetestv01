"use client";

import { ArrowLeft } from "@gravity-ui/icons";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";

/**
 * Regresa a la vista anterior. Si se llegó directo (sin historial en el sitio),
 * va a la página de inicio de la sección. No se muestra en esa página de inicio.
 */
// Vistas recorridas dentro de la app desde la última carga completa de la página.
let vistas = 0;

export function BotonVolver({ inicio }: { inicio: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    vistas++;
  }, [pathname]);
  if (pathname === inicio) return null;

  function volver() {
    // Hay vista anterior si se navegó dentro de la app o se llegó desde el mismo sitio.
    const mismoSitio = document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && (vistas > 1 || mismoSitio)) router.back();
    else router.push(inicio);
  }

  return (
    <div className="mb-3 print:hidden">
      <Button size="sm" variant="tertiary" onPress={volver}>
        <ArrowLeft aria-hidden className="size-4" />
        Volver
      </Button>
    </div>
  );
}
