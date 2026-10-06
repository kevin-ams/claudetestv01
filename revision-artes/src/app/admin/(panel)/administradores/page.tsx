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
      <div className="card p-4">
        <CrearAdminForm />
      </div>
      <ul className="card divide-y divide-border">
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
                <ConfirmButton className="btn btn-danger !px-3 !py-1.5 text-xs" message={`¿Quitar el acceso de ${a.name}?`}>
                  Quitar
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
