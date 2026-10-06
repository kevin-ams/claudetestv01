import { Card } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { listAdmins } from "@/lib/domain/admins";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteAdminAction } from "../actions";
import { CrearAdminForm } from "./crear-admin-form";

export default async function AdministradoresPage() {
  const session = await requireAdmin();
  const admins = await listAdmins();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Administradores</h1>
        <p className="text-sm text-muted">Personas del equipo de comunicación con acceso a este panel.</p>
      </div>
      <Card>
        <Card.Content>
          <CrearAdminForm />
        </Card.Content>
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-separator">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {a.name} {a.id === session.adminId && <span className="text-xs text-muted">(tú)</span>}
                </p>
                <p className="text-sm text-muted">{a.email}</p>
              </div>
              {a.id !== session.adminId && admins.length > 1 && (
                <form action={deleteAdminAction.bind(null, a.id)}>
                  <ConfirmButton
                    size="sm"
                    title={`¿Quitar el acceso de ${a.name}?`}
                    message="Ya no podrá entrar al panel de administración."
                    confirmLabel="Quitar acceso"
                  >
                    Quitar
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
