import { Lock } from "@gravity-ui/icons";
import Link from "next/link";
import { buttonVariants } from "@heroui/styles";
import { getAccess, firstAllowedPath } from "@/lib/auth/access";
import { MODULES } from "@/lib/auth/modules";

export default async function NoAccessPage({ searchParams }: PageProps<"/sin-acceso">) {
  const { modulo } = await searchParams;
  const access = await getAccess();
  const label = MODULES.find((m) => m.key === modulo)?.label;
  const home = access ? firstAllowedPath(access) : "/login";

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
        <Lock width={32} height={32} />
      </p>
      <h1 className="mt-3 text-2xl font-bold">Sin acceso</h1>
      <p className="mt-2 text-sm text-muted">
        Tu rol{access ? ` (${access.roleName})` : ""} no tiene acceso a {label ? <b>{label}</b> : "esta sección"}.
        Si lo necesitas, pídele a un administrador que lo habilite en Ajustes › Roles y accesos.
      </p>
      {home !== "/sin-acceso" && (
        <Link href={home} className={`${buttonVariants({ variant: "primary" })} mt-6 inline-flex`}>
          Ir a una sección disponible
        </Link>
      )}
    </div>
  );
}
