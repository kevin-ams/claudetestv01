"use client";

import { Button, Card, Chip, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import {
  OPTION_KIND_LABEL,
  type EditorialOptions,
  type OptionKind,
} from "@/lib/domain/editorial-shared";
import { addOptionAction, deleteOptionAction } from "@/app/(app)/calendario/actions";

/** Edita las listas desplegables (pilares, estados, paquetes...). */
export function OptionsEditor({
  options,
  kinds,
  title = "Listas",
  defaultOpen = false,
}: {
  options: EditorialOptions;
  kinds: OptionKind[];
  title?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted">Opciones de los desplegables: {kinds.map((k) => OPTION_KIND_LABEL[k]).join(", ")}.</p>
        </div>
        {!defaultOpen && (
          <Button size="sm" variant="outline" onPress={() => setOpen((v) => !v)}>
            {open ? "Cerrar" : "Editar listas"}
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kinds.map((k) => (
            <OptionList key={k} kind={k} items={options[k]} />
          ))}
        </div>
      )}
    </Card>
  );
}

function OptionList({ kind, items }: { kind: OptionKind; items: EditorialOptions[OptionKind] }) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{OPTION_KIND_LABEL[kind]}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((o) => (
          <Chip key={o.id} size="sm" variant="soft" className="gap-1">
            {o.value}
            {o.hint && <span className="text-muted"> · {o.hint}</span>}
            <button
              type="button"
              aria-label={`Quitar ${o.value}`}
              className="ml-1 text-muted hover:text-red"
              onClick={() => start(() => deleteOptionAction(kind, o.id))}
            >
              ✕
            </button>
          </Chip>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addOptionAction(kind, value, hint);
            setError(r.ok ? null : r.message);
            if (r.ok) {
              setValue("");
              setHint("");
            }
          });
        }}
      >
        <Input aria-label={`Nueva opción de ${OPTION_KIND_LABEL[kind]}`} placeholder="Nueva opción" value={value} onChange={(e) => setValue(e.target.value)} className="flex-1" />
        {(kind === "cob_paquete" || kind === "pilar") && (
          <Input aria-label="Detalle" placeholder={kind === "pilar" ? "Mezcla" : "≈ horas"} value={hint} onChange={(e) => setHint(e.target.value)} className="w-24" />
        )}
        <Button size="sm" type="submit" variant="secondary" isDisabled={pending || !value.trim()}>
          +
        </Button>
      </form>
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
