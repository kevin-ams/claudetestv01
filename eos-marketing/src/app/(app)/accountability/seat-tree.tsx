"use client";

import { ChevronDown, ChevronUp, Ellipsis, Minus, Pencil, Plus, TriangleExclamation } from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Modal, TextArea } from "@heroui/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MultiOwnerSelect } from "@/components/multi-owner-select";
import { UserAvatar } from "@/components/user-avatar";
import { AppSelect } from "@/components/ui/select";
import type { Seat } from "@/lib/domain/types";
import { createSeatAction, deleteSeatAction, moveSeatAction, updateSeatAction, type SeatInput } from "./actions";

export type OrgPerson = { id: number; name: string; avatar: string | null; color?: string };

const LMA = "Liderar, Gestionar y Rendir cuentas (LMA)";
const STALE = "No se pudo completar. Si se publicó una versión nueva, recarga la página.";
const hasLma = (roles: string[]) => /\blma\b|liderar.*gestionar/i.test(roles[0] ?? "");

/** Reglas EOS que se marcan en cada puesto (no bloquean). */
function seatWarnings(seat: Seat, hasChildren: boolean): string[] {
  const out: string[] = [];
  if (seat.people.length === 0) out.push("Sin persona asignada");
  if (seat.roles.length === 0) out.push("Sin roles: define unos 5");
  else if (seat.roles.length > 5) out.push(`${seat.roles.length} roles: lo ideal son unos 5`);
  if (hasChildren && seat.people.length > 1) out.push("Un puesto con puestos debajo lo ocupa una sola persona");
  if (hasChildren && seat.roles.length > 0 && !hasLma(seat.roles)) out.push("Con puestos debajo: el primer rol debería ser LMA");
  return out;
}

/** Puestos que dependen (directa o indirectamente) de un puesto. */
function descendantsOf(seatId: number, all: Seat[]): Set<number> {
  const out = new Set<number>();
  const walk = (id: number) => {
    for (const s of all) {
      if (s.parent_seat_id === id && !out.has(s.id)) {
        out.add(s.id);
        walk(s.id);
      }
    }
  };
  walk(seatId);
  return out;
}

/** Lista de puestos con sangría según su nivel (para los selectores). */
function seatOptions(seats: Seat[], exclude: Set<number> = new Set()) {
  const out: { id: number; label: string }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const s of seats.filter((x) => x.parent_seat_id === parent)) {
      if (exclude.has(s.id)) continue;
      out.push({ id: s.id, label: `${"— ".repeat(depth)}${s.title}` });
      walk(s.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

type Editing = { mode: "new"; parentSeatId: number | null } | { mode: "edit"; seat: Seat };

function SeatModal({ editing, seats, people, onClose }: { editing: Editing; seats: Seat[]; people: OrgPerson[]; onClose: () => void }) {
  const seat = editing.mode === "edit" ? editing.seat : null;
  const [title, setTitle] = useState(seat?.title ?? "");
  const [owners, setOwners] = useState<number[]>(seat?.people ?? []);
  const [parent, setParent] = useState(String((seat ? seat.parent_seat_id : editing.mode === "new" ? editing.parentSeatId : null) ?? "-"));
  const [roles, setRoles] = useState((seat?.roles ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blocked = seat ? new Set([seat.id, ...descendantsOf(seat.id, seats)]) : new Set<number>();
  const roleList = roles.split("\n").map((r) => r.trim()).filter(Boolean);
  const hasChildren = seat ? seats.some((s) => s.parent_seat_id === seat.id) : false;

  const save = () =>
    start(async () => {
      const input: SeatInput = { title, people: owners, roles: roleList, parentSeatId: parent === "-" ? null : Number(parent) };
      const r = await (seat ? updateSeatAction(seat.id, input) : createSeatAction(input)).catch(() => ({ ok: false, message: STALE }));
      if (r.ok) onClose();
      else setError(r.message);
    });

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg" aria-label={seat ? "Editar puesto" : "Nuevo puesto"}>
          <Modal.CloseTrigger />
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2 className="text-lg font-semibold">{seat ? "Editar puesto" : "Nuevo puesto"}</h2>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Función del puesto
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Visionario, Integrador, Ventas/Marketing, Operaciones, Finanzas" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Persona(s) en el puesto
              <MultiOwnerSelect
                members={people}
                value={owners}
                onChange={setOwners}
                inline
                ariaLabel="Personas"
                emptyLabel="Sin asignar"
                hint="Si varias personas hacen la misma función (p. ej. asesores), agrégalas aquí: el puesto muestra cuántas son y su lista."
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Reporta a
              <AppSelect aria-label="Reporta a" value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="-">Nadie (puesto superior)</option>
                {seatOptions(seats, blocked).map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.label}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              <span className="flex items-center justify-between gap-2">
                Roles y responsabilidades (uno por línea · {roleList.length}/5)
                {!hasLma(roleList) && (
                  <button type="button" className="text-primary hover:underline" onClick={() => setRoles((r) => `${LMA}\n${r}`.trim())}>
                    + Agregar LMA al inicio
                  </button>
                )}
              </span>
              <TextArea value={roles} onChange={(e) => setRoles(e.target.value)} className="min-h-32" placeholder={"Liderar, Gestionar y Rendir cuentas (LMA)\nVentas\nMarketing\nAlcanzar la meta de ingresos"} />
            </label>
            <p className="text-[11px] text-muted">
              EOS: cada puesto es una función con unos 5 roles. Los puestos que tienen otros debajo empiezan con LMA y los ocupa
              una sola persona{hasChildren && owners.length > 1 ? " (este tiene puestos debajo)" : ""}. Cada puesto reporta a uno solo.
            </p>
            {error && <p className="text-sm text-red">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" isPending={pending} isDisabled={!title.trim()}>
                Guardar
              </Button>
              <Button type="button" variant="outline" onPress={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Menú "…" del puesto. */
function SeatMenu({ onAdd, onLeft, onRight, onDelete }: { onAdd: () => void; onLeft?: () => void; onRight?: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, fn: () => void, danger = false) => (
    <button
      type="button"
      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-default ${danger ? "text-red" : ""}`}
      onClick={() => {
        setOpen(false);
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <div ref={box} className="relative">
      <Button isIconOnly size="sm" variant="ghost" aria-label="Más opciones" onPress={() => setOpen((v) => !v)}>
        <Ellipsis aria-hidden />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
          {item("Agregar puesto debajo", onAdd)}
          {onLeft && item("Mover a la izquierda", onLeft)}
          {onRight && item("Mover a la derecha", onRight)}
          {item("Eliminar puesto", onDelete, true)}
        </div>
      )}
    </div>
  );
}

function SeatCard({
  seat,
  seats,
  people,
  editable,
  collapsed,
  onToggle,
  onEdit,
  onAdd,
}: {
  seat: Seat;
  seats: Seat[];
  people: OrgPerson[];
  editable: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAdd: () => void;
}) {
  const [pending, start] = useTransition();
  const children = seats.filter((s) => s.parent_seat_id === seat.id);
  const siblings = seats.filter((s) => s.parent_seat_id === seat.parent_seat_id);
  const index = siblings.findIndex((s) => s.id === seat.id);
  const who = seat.people.map((id) => people.find((p) => p.id === id)).filter((p): p is OrgPerson => Boolean(p));
  const warnings = editable ? seatWarnings(seat, children.length > 0) : [];

  return (
    <Card className={`flex w-64 flex-col gap-0 p-0 text-left ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-1 px-3 pt-3">
        <h3 className="pt-1 font-semibold leading-tight">{seat.title}</h3>
        {editable && (
          <span className="flex shrink-0">
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Editar ${seat.title}`} onPress={onEdit}>
              <Pencil aria-hidden />
            </Button>
            <SeatMenu
              onAdd={onAdd}
              onLeft={index > 0 ? () => start(async () => void (await moveSeatAction(seat.id, "left"))) : undefined}
              onRight={index < siblings.length - 1 ? () => start(async () => void (await moveSeatAction(seat.id, "right"))) : undefined}
              onDelete={() => {
                const msg = children.length
                  ? `¿Eliminar el puesto "${seat.title}"? Los ${children.length} puesto(s) que dependen de él pasan a reportar al nivel de arriba.`
                  : `¿Eliminar el puesto "${seat.title}"?`;
                if (confirm(msg)) start(async () => void (await deleteSeatAction(seat.id)));
              }}
            />
          </span>
        )}
      </div>

      <div className="px-3 pb-2 pt-1">
        {who.length === 0 ? (
          <p className="text-sm text-muted">Sin asignar</p>
        ) : who.length === 1 ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={who[0].name} src={who[0].avatar} color={who[0].color} />
            <span className="text-sm text-muted">{who[0].name}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {who.slice(0, 4).map((p) => (
                  <UserAvatar key={p.id} name={p.name} src={p.avatar} color={p.color} className="ring-2 ring-card" />
                ))}
              </span>
              <Chip size="sm" variant="soft" color="accent">
                {who.length} personas
              </Chip>
            </div>
            <ul className="text-xs text-muted">
              {who.map((p) => (
                <li key={p.id}>• {p.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Roles y responsabilidades</p>
        {seat.roles.length === 0 ? (
          <p className="text-xs text-muted">Sin definir</p>
        ) : (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-medium">
            {seat.roles.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-1 text-[11px] text-yellow">
                <TriangleExclamation width={11} height={11} className="mt-0.5 shrink-0" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between px-2 pb-2">
        {editable ? (
          <Button isIconOnly size="sm" variant="ghost" className="rounded-full text-primary" aria-label={`Agregar puesto debajo de ${seat.title}`} onPress={onAdd}>
            <Plus aria-hidden />
          </Button>
        ) : (
          <span />
        )}
        {children.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted" onPress={onToggle} aria-expanded={!collapsed}>
            {collapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
            {collapsed ? `${children.length} debajo` : "Ocultar"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Branch(props: {
  seat: Seat;
  seats: Seat[];
  people: OrgPerson[];
  editable: boolean;
  collapsed: Set<number>;
  toggle: (id: number) => void;
  setEditing: (e: Editing) => void;
}) {
  const { seat, seats, collapsed } = props;
  const children = seats.filter((s) => s.parent_seat_id === seat.id);
  const isCollapsed = collapsed.has(seat.id);
  return (
    <li className="ac-node">
      <SeatCard
        seat={seat}
        seats={seats}
        people={props.people}
        editable={props.editable}
        collapsed={isCollapsed}
        onToggle={() => props.toggle(seat.id)}
        onEdit={() => props.setEditing({ mode: "edit", seat })}
        onAdd={() => props.setEditing({ mode: "new", parentSeatId: seat.id })}
      />
      {children.length > 0 && !isCollapsed && (
        <ul className="ac-children">
          {children.map((c) => (
            <Branch key={c.id} {...props} seat={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SeatTree({ seats, people, editable }: { seats: Seat[]; people: OrgPerson[]; editable: boolean }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [top, setTop] = useState("-");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState(100);
  const options = useMemo(() => seatOptions(seats), [seats]);
  const roots = top === "-" ? seats.filter((s) => s.parent_seat_id === null) : seats.filter((s) => String(s.id) === top);
  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const withChildren = seats.filter((s) => seats.some((c) => c.parent_seat_id === s.id)).map((s) => s.id);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-row flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Puesto superior</span>
        <AppSelect aria-label="Puesto superior" className="w-64" value={top} onChange={(e) => setTop(e.target.value)}>
          <option value="-">Toda la organización</option>
          {options.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </AppSelect>
        <Button size="sm" variant="ghost" onPress={() => setCollapsed(collapsed.size ? new Set() : new Set(withChildren))}>
          {collapsed.size ? "Expandir todo" : "Contraer todo"}
        </Button>
        <span className="flex items-center gap-1">
          <Button isIconOnly size="sm" variant="ghost" aria-label="Alejar" isDisabled={zoom <= 50} onPress={() => setZoom((z) => z - 10)}>
            <Minus aria-hidden />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted">{zoom}%</span>
          <Button isIconOnly size="sm" variant="ghost" aria-label="Acercar" isDisabled={zoom >= 120} onPress={() => setZoom((z) => z + 10)}>
            <Plus aria-hidden />
          </Button>
        </span>
        {editable && (
          <Button size="sm" variant="primary" className="ml-auto" onPress={() => setEditing({ mode: "new", parentSeatId: null })}>
            <Plus aria-hidden /> Puesto superior
          </Button>
        )}
      </Card>

      {seats.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay puestos. Empieza por la función superior (por ejemplo, Visionario o Integrador) y luego agrega las
          funciones principales debajo: Ventas/Marketing, Operaciones y Finanzas.
        </p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-border bg-background/60 p-6 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px]">
          <div className="mx-auto w-max origin-top" style={{ zoom: zoom / 100 }}>
            <ul className="ac-children ac-root">
              {roots.map((s) => (
                <Branch key={s.id} seat={s} seats={seats} people={people} editable={editable} collapsed={collapsed} toggle={toggle} setEditing={setEditing} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {editing && <SeatModal key={JSON.stringify(editing)} editing={editing} seats={seats} people={people} onClose={() => setEditing(null)} />}
    </div>
  );
}
