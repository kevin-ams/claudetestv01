"use client";

import { Button } from "@heroui/react";

/** Errores dentro de la app (por ejemplo, una acción sin permiso). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const denied = error.name === "AccessDeniedError" || /permiso/i.test(error.message);
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-2xl font-bold">{denied ? "Sin permiso para este cambio" : "Algo salió mal"}</h1>
      <p className="mt-2 text-sm text-muted">
        {denied
          ? "Tu rol no permite editar este módulo. Pídele a un administrador que te dé acceso de edición."
          : "No se pudo completar la acción. Si estabas haciendo un cambio, puede que tu rol no tenga permiso de edición en este módulo; si no, intenta de nuevo."}
      </p>
      {error.digest && <p className="mt-3 text-xs text-muted">Código del error: {error.digest}</p>}
      <Button className="mt-6" onPress={reset}>
        Volver a intentar
      </Button>
    </div>
  );
}
