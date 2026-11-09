"use client";

import { Button } from "@heroui/react";

/** Errores dentro de la app (por ejemplo, una acción sin permiso). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const denied = error.name === "AccessDeniedError" || /permiso/i.test(error.message);
  // La página se abrió antes de publicar una versión nueva: sus acciones ya no existen en el servidor.
  const outdated =
    error.name === "UnrecognizedActionError" || /Server Action .* was not found on the server|failed-to-find-server-action/i.test(error.message);

  if (outdated) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-2xl font-bold">Hay una versión nueva de la plataforma</h1>
        <p className="mt-2 text-sm text-muted">
          Esta página se abrió antes de la última actualización, por eso no se pudo completar la acción. Recarga la
          página y vuelve a intentarlo; no se perdió nada.
        </p>
        <Button className="mt-6" variant="primary" onPress={() => window.location.reload()}>
          Recargar la página
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-2xl font-bold">{denied ? "Sin permiso para este cambio" : "Algo salió mal"}</h1>
      <p className="mt-2 text-sm text-muted">
        {denied
          ? "Tu rol no permite editar este módulo. Pídele a un administrador que te dé acceso de edición."
          : "No se pudo completar la acción. Si estabas haciendo un cambio, puede que tu rol no tenga permiso de edición en este módulo; si no, recarga la página e intenta de nuevo."}
      </p>
      {error.digest && <p className="mt-3 text-xs text-muted">Código del error: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <Button onPress={reset}>Volver a intentar</Button>
        <Button variant="outline" onPress={() => window.location.reload()}>
          Recargar la página
        </Button>
      </div>
    </div>
  );
}
