"use client";

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
    <select
      name="userId"
      defaultValue={defaultValue ?? "none"}
      className="eos-input"
    >
      <option value="none">Sin asignar</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function SeatForm({
  members,
  parentSeatId,
  onDone,
  seat,
}: {
  members: PublicUser[];
  parentSeatId: number | null;
  onDone: () => void;
  seat?: Seat;
}) {
  return (
    <form
      action={async (fd) => {
        fd.set("parentSeatId", parentSeatId === null ? "none" : String(parentSeatId));
        if (seat) {
          await updateSeatAction(seat.id, fd);
        } else {
          await createSeatAction(fd);
        }
        onDone();
      }}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <input
        name="title"
        required
        className="eos-input"
        placeholder="Nombre del asiento (ej. Visionario, Integrador, Ventas)"
        defaultValue={seat?.title}
      />
      <UserSelect members={members} defaultValue={seat?.user_id} />
      <textarea
        name="roles"
        className="eos-input min-h-20"
        placeholder={"Roles / responsabilidades, una por línea"}
        defaultValue={(seat?.roles ?? []).join("\n")}
      />
      <div className="flex gap-2">
        <button type="submit" className="eos-btn eos-btn-primary">
          Guardar
        </button>
        <button type="button" className="eos-btn eos-btn-secondary" onClick={onDone}>
          Cancelar
        </button>
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
      <div className="eos-card w-72 p-4 text-center">
        {editing ? (
          <SeatForm
            members={members}
            parentSeatId={seat.parent_seat_id}
            seat={seat}
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
              <button
                className="font-medium text-primary underline"
                onClick={() => setEditing(true)}
              >
                Editar
              </button>
              <button
                className="font-medium text-primary underline"
                onClick={() => setAddingChild((v) => !v)}
              >
                + Asiento debajo
              </button>
              <button
                className="font-medium text-red underline"
                onClick={async () => {
                  if (confirm(`¿Eliminar el asiento "${seat.title}"?`)) {
                    await deleteSeatAction(seat.id);
                  }
                }}
              >
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>

      {addingChild && (
        <div className="mt-3 w-72">
          <SeatForm
            members={members}
            parentSeatId={seat.id}
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
        <button className="eos-btn eos-btn-secondary" onClick={() => setAddingRoot((v) => !v)}>
          + Agregar asiento raíz
        </button>
      </div>

      {addingRoot && (
        <div className="mb-8 max-w-md">
          <SeatForm members={members} parentSeatId={null} onDone={() => setAddingRoot(false)} />
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
