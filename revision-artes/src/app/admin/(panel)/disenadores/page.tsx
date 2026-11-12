import { Card } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { listDisenadores } from "@/lib/domain/disenadores";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteDisenadorAction } from "../actions";
import { CrearDisenador } from "./crear-disenador";

export default async function DisenadoresPage() {
  await requireAdmin();
  const disenadores = await listDisenadores();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Diseñadores</h1>
        <p className="text-sm text-muted">
          Personas de Diseño a quienes se envía el reporte de cambios. Aparecen para elegirlas con un clic en “Enviar
          reporte a Diseño”.
        </p>
      </div>
      <Card>
        <Card.Content>
          <CrearDisenador />
        </Card.Content>
      </Card>
      {disenadores.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Aún no hay diseñadores en la lista.</Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-separator">
            {disenadores.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{d.nombre}</p>
                  <p className="text-sm text-muted">{d.email}</p>
                </div>
                <form action={deleteDisenadorAction.bind(null, d.id)}>
                  <ConfirmButton
                    size="sm"
                    title={`¿Quitar a ${d.nombre}?`}
                    message="Ya no aparecerá al enviar reportes a Diseño."
                    confirmLabel="Quitar"
                  >
                    Quitar
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
