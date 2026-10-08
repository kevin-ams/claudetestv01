"use client";

import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { KIND_LABEL, type Tool, type ToolAccess, type ToolKind } from "@/lib/domain/tools-shared";
import { deleteToolAction, moveToolAction, saveToolAction, toggleToolAction, type ToolResult } from "./actions";

type Option = { id: number; name: string; isAdmin?: boolean };

function toggle(list: number[], id: number, on: boolean) {
  return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
}

function ToolForm({
  tool,
  roles,
  members,
  onDone,
}: {
  tool?: Tool;
  roles: Option[];
  members: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(tool?.name ?? "");
  const [icon, setIcon] = useState(tool?.icon ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [kind, setKind] = useState<ToolKind>(tool?.kind ?? "link");
  const [url, setUrl] = useState(tool?.url ?? "");
  const [access, setAccess] = useState<ToolAccess>(tool?.access ?? "all");
  const [roleIds, setRoleIds] = useState<number[]>(tool?.role_ids ?? []);
  const [userIds, setUserIds] = useState<number[]>(tool?.user_ids ?? []);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveToolAction(tool?.id ?? null, { name, icon, description, kind, url, access, roleIds, userIds });
          setResult(r);
          if (r.ok) {
            router.refresh();
            onDone();
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Ícono"
          placeholder="🔗"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-16 text-center"
          title="Un emoji como ícono (opcional)"
        />
        <Input
          aria-label="Nombre de la herramienta"
          placeholder="Nombre (p. ej. Canva, Tablero de pauta, Drive del equipo)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-60 flex-1"
          required
        />
      </div>
      <TextArea
        fullWidth
        aria-label="Descripción"
        placeholder="Para qué sirve (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-14"
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Tipo</span>
        <Segmented
          aria-label="Tipo de herramienta"
          options={[
            { id: "link" as const, label: "🔗 Enlace directo" },
            { id: "embed" as const, label: "🧩 Sitio dentro de la app" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <p className="text-xs text-muted">
          {kind === "link"
            ? "Se abre en una pestaña nueva."
            : "El sitio se muestra dentro de la app. Algunos sitios no lo permiten (por ejemplo Gmail o Facebook); en ese caso queda el botón para abrirlo aparte. Los enlaces de YouTube y de Google Docs, Sheets, Slides o Drive se convierten solos a su versión para insertar."}
        </p>
      </div>
      <Input
        aria-label="Dirección (URL)"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        type="url"
        required
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">¿Quién la ve?</span>
        <Segmented
          aria-label="Acceso"
          options={[
            { id: "all" as const, label: "Todo el equipo" },
            { id: "restricted" as const, label: "Solo roles o personas elegidas" },
          ]}
          value={access}
          onChange={setAccess}
        />
        {access === "restricted" && (
          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Roles</p>
              {roles.map((r) => (
                <AppCheckbox
                  key={r.id}
                  checked={r.isAdmin || roleIds.includes(r.id)}
                  disabled={r.isAdmin}
                  onChange={(e) => setRoleIds((l) => toggle(l, r.id, e.target.checked))}
                >
                  {r.name}
                  {r.isAdmin ? " (siempre)" : ""}
                </AppCheckbox>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Personas</p>
              {members.map((m) => (
                <AppCheckbox key={m.id} checked={userIds.includes(m.id)} onChange={(e) => setUserIds((l) => toggle(l, m.id, e.target.checked))}>
                  {m.name}
                </AppCheckbox>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" isDisabled={pending}>
          {pending ? "Guardando…" : tool ? "Guardar cambios" : "Agregar herramienta"}
        </Button>
        <Button type="button" variant="outline" size="sm" onPress={onDone}>
          Cancelar
        </Button>
        {result && !result.ok && <span className="text-sm text-red">{result.message}</span>}
      </div>
    </form>
  );
}

function audience(tool: Tool, roles: Option[], members: Option[]) {
  if (tool.access === "all") return "Todo el equipo";
  const names = [
    ...roles.filter((r) => tool.role_ids.includes(r.id)).map((r) => r.name),
    ...members.filter((m) => tool.user_ids.includes(m.id)).map((m) => m.name),
  ];
  return `Solo: ${names.join(", ") || "nadie"} · y administradores`;
}

export function ToolsManager({ tools, roles, members }: { tools: Tool[]; roles: Option[]; members: Option[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {tools.length} herramienta(s) ·{" "}
          <Link href="/herramientas" className="text-primary underline">
            ver “Otras herramientas”
          </Link>
        </p>
        {editing !== "new" && (
          <Button variant="primary" size="sm" onPress={() => setEditing("new")}>
            + Nueva herramienta
          </Button>
        )}
      </div>

      {editing === "new" && (
        <Card className="p-4">
          <ToolForm roles={roles} members={members} onDone={() => setEditing(null)} />
        </Card>
      )}

      {tools.length === 0 && editing !== "new" && (
        <p className="card card--default p-6 text-sm text-muted">
          Todavía no hay herramientas. Agrega un enlace directo (Canva, Drive, un tablero) o un sitio para ver dentro de la app.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tools.map((t, i) => (
          <li key={t.id}>
            <Card className={`p-4 ${t.active ? "" : "opacity-60"}`}>
              {editing === t.id ? (
                <ToolForm tool={t} roles={roles} members={members} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <span className="text-2xl" aria-hidden>
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t.name}{" "}
                      <Chip size="sm" variant="soft" className="ml-1">
                        {KIND_LABEL[t.kind]}
                      </Chip>
                      {!t.active && (
                        <Chip size="sm" variant="soft" color="warning" className="ml-1">
                          Oculta
                        </Chip>
                      )}
                    </p>
                    {t.description && <p className="text-sm text-muted">{t.description}</p>}
                    <p className="truncate text-xs text-muted" title={t.url}>
                      {t.url}
                    </p>
                    <p className="text-xs">
                      <span className="text-muted">Acceso:</span> {audience(t, roles, members)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Subir ${t.name}`} isDisabled={pending || i === 0} onPress={() => run(() => moveToolAction(t.id, -1))}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Bajar ${t.name}`}
                      isDisabled={pending || i === tools.length - 1}
                      onPress={() => run(() => moveToolAction(t.id, 1))}
                    >
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => run(() => toggleToolAction(t.id, !t.active))}>
                      {t.active ? "Ocultar" : "Mostrar"}
                    </Button>
                    <Button size="sm" variant="outline" onPress={() => setEditing(t.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red"
                      isDisabled={pending}
                      onPress={() => {
                        if (confirm(`¿Quitar “${t.name}” de la caja de herramientas?`)) run(() => deleteToolAction(t.id, t.name));
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
