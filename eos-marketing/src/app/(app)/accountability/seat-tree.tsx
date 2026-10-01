"use client";

import { Button, Card, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useState } from "react";
import type { Seat } from "@/lib/domain/types";
import type { PublicUser } from "@/lib/domain/types";
import { createSeatAction, updateSeatAction, deleteSeatAction } from "./actions";

type Props = {
  seats: Seat[];
  members: PublicUser[];
};

function userName(members: PublicUser[], userId: number | null) {
  if (!userId) return "Sin asignar";
  return members.find((m) => m.id === userId)?.name ?? "Sin asignar";
}

function UserSelect({
  members,
  defaultValue,
}: {
  members: PublicUser[];
  defaultValue?: number | null;
}) {
  return (
    <AppSelect fullWidth
      name="userId"
      defaultValue={defaultValue ?? "none"}
    >
      <option value="none">Sin asignar</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </AppSelect>
  );
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

function SeatForm({
  members,
  parentSeatId,
  onDone,
  seat,
  allSeats,
}: {
  members: PublicUser[];
  parentSeatId: number | null;
  onDone: () => void;
  seat?: Seat;
  allSeats: Seat[];
}) {
  // No puede reportar a sí mismo ni a quien depende de él.
  const blocked = seat ? new Set([seat.id, ...descendantsOf(seat.id, allSeats)]) : new Set<number>();
  const options = allSeats.filter((s) => !blocked.has(s.id));
  return (
    <form
      action={async (fd) => {
        if (seat) {
          await updateSeatAction(seat.id, fd);
        } else {
          await createSeatAction(fd);
        }
        onDone();
      }}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <Input fullWidth
        name="title"
        required
        placeholder="Nombre del asiento (ej. Visionario, Integrador, Ventas)"
        defaultValue={seat?.title}
      />
      <UserSelect members={members} defaultValue={seat?.user_id} />
      <AppSelect fullWidth name="parentSeatId" aria-label="Reporta a" defaultValue={parentSeatId ?? "none"}>
        <option value="none">Reporta a: nadie (nivel superior)</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            Reporta a: {s.title}
          </option>
        ))}
      </AppSelect>
      {seat && (
        <p className="text-left text-[11px] text-muted">
          Solo cambia la posición de este puesto (y de quienes dependen de él); los demás no se mueven.
        </p>
      )}
      <TextArea fullWidth
        name="roles"
        className="min-h-20"
        placeholder={"Roles / responsabilidades, una por línea"}
        defaultValue={(seat?.roles ?? []).join("\n")}
      />
      <div className="flex gap-2">
        <Button variant="primary" type="submit">
          Guardar
        </Button>
        <Button variant="outline" type="button" onPress={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function SeatNode({
  seat,
  allSeats,
  members,
}: {
  seat: Seat;
  allSeats: Seat[];
  members: PublicUser[];
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const children = allSeats.filter((s) => s.parent_seat_id === seat.id);

  return (
    <div className="flex flex-col items-center">
      <Card className="block gap-0 w-72 p-4 text-center">
        {editing ? (
          <SeatForm
            members={members}
            parentSeatId={seat.parent_seat_id}
            seat={seat}
            allSeats={allSeats}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="font-semibold">{seat.title}</p>
            <p className="text-sm text-primary">{userName(members, seat.user_id)}</p>
            {seat.roles.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-left text-xs text-muted">
                {seat.roles.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-center gap-3 text-xs">
              <Button size="sm" variant="ghost"
                className="text-primary"
                onPress={() => setEditing(true)}
              >
                Editar
              </Button>
              <Button size="sm" variant="ghost"
                className="text-primary"
                onPress={() => setAddingChild((v) => !v)}
              >
                + Asiento debajo
              </Button>
              <Button size="sm" variant="ghost"
                className="text-red"
                onPress={async () => {
                  const msg = children.length
                    ? `¿Eliminar el asiento "${seat.title}"? Los ${children.length} puesto(s) que dependen de él no se borran: pasan a reportar al nivel de arriba.`
                    : `¿Eliminar el asiento "${seat.title}"?`;
                  if (confirm(msg)) {
                    await deleteSeatAction(seat.id);
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          </>
        )}
      </Card>

      {addingChild && (
        <div className="mt-3 w-72">
          <SeatForm
            members={members}
            parentSeatId={seat.id}
            allSeats={allSeats}
            onDone={() => setAddingChild(false)}
          />
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-8 border-t border-border pt-6">
          {children.map((child) => (
            <SeatNode key={child.id} seat={child} allSeats={allSeats} members={members} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SeatTree({ seats, members }: Props) {
  const [addingRoot, setAddingRoot] = useState(false);
  const roots = seats.filter((s) => s.parent_seat_id === null);

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button variant="outline" onPress={() => setAddingRoot((v) => !v)}>
          + Agregar puesto de nivel superior
        </Button>
      </div>

      {addingRoot && (
        <div className="mb-8 max-w-md">
          <SeatForm members={members} parentSeatId={null} allSeats={seats} onDone={() => setAddingRoot(false)} />
        </div>
      )}

      {roots.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no tienes ningún asiento. Empieza agregando el asiento raíz
          (por ejemplo, Visionario / Integrador).
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-10 overflow-x-auto pb-4">
          {roots.map((seat) => (
            <SeatNode key={seat.id} seat={seat} allSeats={seats} members={members} />
          ))}
        </div>
      )}
    </div>
  );
}
