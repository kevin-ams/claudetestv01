"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { ADMIN_ONLY_MODULES, LEVEL_LABEL, MODULES, PREMIUM_MODULES, levelFor, type AccessLevel, type ModuleKey } from "@/lib/auth/modules";
import type { TeamRole } from "@/lib/domain/roles";
import { createRoleAction, deleteRoleAction, updateRoleAction, type RoleResult } from "./actions";

type Draft = Record<ModuleKey, AccessLevel>;

function draftFor(role: Pick<TeamRole, "permissions" | "is_admin" | "is_premium"> | null): Draft {
  return Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      role
        ? levelFor(role.permissions, role.is_admin, m.key, role.is_premium)
        : PREMIUM_MODULES.includes(m.key)
          ? "none"
          : m.key === "ajustes"
            ? "view"
            : "edit",
    ])
  ) as Draft;
}

const LEVEL_COLOR: Record<AccessLevel, "success" | "warning" | "default"> = {
  edit: "success",
  view: "warning",
  none: "default",
};

function PermissionGrid({
  draft,
  onChange,
  disabled,
  isOwner,
  premiumRole = false,
  onlyPremium = false,
}: {
  draft: Draft;
  onChange?: (module: ModuleKey, level: AccessLevel) => void;
  disabled: boolean;
  /** Dueño de la plataforma: puede abrir módulos premium a este rol. */
  isOwner: boolean;
  premiumRole?: boolean;
  /** Rol administrador: solo se pueden cambiar los módulos premium. */
  onlyPremium?: boolean;
}) {
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {MODULES.map((m) => (
        <div key={m.key} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            {m.label}
            {PREMIUM_MODULES.includes(m.key) && (
              <Chip size="sm" variant="soft" color="warning">
                Premium
              </Chip>
            )}
          </span>
          {PREMIUM_MODULES.includes(m.key) && premiumRole ? (
            <Chip size="sm" variant="soft" color="success">
              Incluido
            </Chip>
          ) : PREMIUM_MODULES.includes(m.key) && !(isOwner && onChange && !disabled) ? (
            <Chip size="sm" variant="soft" color={LEVEL_COLOR[draft[m.key]]} title="Solo el dueño de la plataforma lo cambia">
              {draft[m.key] === "none" ? "Solo Premium" : LEVEL_LABEL[draft[m.key]]}
            </Chip>
          ) : ADMIN_ONLY_MODULES.includes(m.key) ? (
            <Chip size="sm" variant="soft">
              Solo administradores
            </Chip>
          ) : disabled || !onChange || (onlyPremium && !PREMIUM_MODULES.includes(m.key)) ? (
            <Chip size="sm" variant="soft" color={LEVEL_COLOR[draft[m.key]]}>
              {LEVEL_LABEL[draft[m.key]]}
            </Chip>
          ) : (
            <AppSelect
              aria-label={`Acceso a ${m.label}`}
              className="w-40"
              variant="secondary"
              value={draft[m.key]}
              onChange={(e) => onChange(m.key, e.target.value as AccessLevel)}
            >
              <option value="edit">{LEVEL_LABEL.edit}</option>
              <option value="view">{LEVEL_LABEL.view}</option>
              <option value="none">{LEVEL_LABEL.none}</option>
            </AppSelect>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleCard({ role, canEdit, isOwner }: { role: TeamRole; canEdit: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFor(role));
  const [name, setName] = useState(role.name);
  const [result, setResult] = useState<RoleResult | null>(null);
  const [pending, startTransition] = useTransition();
  // Los roles administradores no se editan, salvo que el dueño de la plataforma les abra módulos premium.
  const ownerOnly = role.is_admin && !role.is_premium && isOwner;
  const editable = canEdit && (!role.is_admin || ownerOnly);

  const run = (fn: () => Promise<RoleResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {editable && !role.is_system ? (
            <Input aria-label="Nombre del rol" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
          ) : (
            <Card.Title className="text-base">{role.name}</Card.Title>
          )}
          {role.is_premium && <Chip size="sm" color="warning" variant="soft">Premium</Chip>}
          {role.is_admin && <Chip size="sm" color="accent" variant="soft">Acceso total</Chip>}
          {role.is_system && !role.is_admin && <Chip size="sm" variant="soft">Rol base</Chip>}
        </div>
        <span className="text-sm text-muted">{role.members} persona(s)</span>
      </Card.Header>
      <Card.Content>
        {role.is_admin && (
          <p className="mb-2 text-sm text-muted">
            {role.is_premium
              ? "Todo lo de Administrador más los módulos premium. Solo el dueño de la plataforma asigna este rol."
              : "Ve y edita todo (salvo los módulos premium), y es el único que administra equipo, roles y equipos."}
          </p>
        )}
        <PermissionGrid
          draft={draft}
          isOwner={isOwner}
          premiumRole={role.is_premium}
          onlyPremium={ownerOnly}
          disabled={!editable}
          onChange={(module, level) => setDraft((d) => ({ ...d, [module]: level }))}
        />
      </Card.Content>
      {editable && (
        <Card.Footer className="flex-wrap gap-2">
          <Button isPending={pending} onPress={() => run(() => updateRoleAction(role.id, name, draft))}>
            Guardar permisos
          </Button>
          {!role.is_system && (
            <Button
              variant="danger-soft"
              isDisabled={pending}
              onPress={() => {
                if (confirm(`¿Eliminar el rol "${role.name}"? Sus personas pasarán a Usuario.`)) run(() => deleteRoleAction(role.id));
              }}
            >
              Eliminar rol
            </Button>
          )}
          {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
        </Card.Footer>
      )}
    </Card>
  );
}

function NewRole({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftFor(null));
  const [result, setResult] = useState<RoleResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" className="self-start" onPress={() => setOpen(true)}>
        + Nuevo rol
      </Button>
    );
  }
  return (
    <Card>
      <Card.Header>
        <Card.Title>Nuevo rol</Card.Title>
        <Card.Description>Por ejemplo &quot;Coordinador&quot; o &quot;Solo lectura&quot;.</Card.Description>
      </Card.Header>
      <Card.Content className="gap-3">
        <Input aria-label="Nombre del rol" placeholder="Nombre del rol" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
        <PermissionGrid draft={draft} disabled={false} isOwner={isOwner} onChange={(m, l) => setDraft((d) => ({ ...d, [m]: l }))} />
      </Card.Content>
      <Card.Footer className="flex-wrap gap-2">
        <Button
          isPending={pending}
          onPress={() =>
            startTransition(async () => {
              const res = await createRoleAction(name, draft);
              setResult(res);
              if (res.ok) {
                setOpen(false);
                setName("");
                router.refresh();
              }
            })
          }
        >
          Crear rol
        </Button>
        <Button variant="tertiary" onPress={() => setOpen(false)}>
          Cancelar
        </Button>
        {result && !result.ok && <span className="text-sm text-red">{result.message}</span>}
      </Card.Footer>
    </Card>
  );
}

export function RolesEditor({ roles, canEdit, isOwner }: { roles: TeamRole[]; canEdit: boolean; isOwner: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Solo un administrador puede cambiar los roles. Puedes ver los permisos de cada uno.
        </p>
      )}
      {roles.map((r) => (
        <RoleCard key={`${r.id}-${JSON.stringify(r.permissions)}-${r.name}`} role={r} canEdit={canEdit} isOwner={isOwner} />
      ))}
      {canEdit && <NewRole isOwner={isOwner} />}
    </div>
  );
}
