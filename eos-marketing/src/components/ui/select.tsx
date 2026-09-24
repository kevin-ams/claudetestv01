"use client";

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { ListBox, Select } from "@heroui/react";

/** Evento mínimo compatible con el onChange de un <select> nativo. */
export type SelectChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };
type Option = { key: string; value: string; label: ReactNode; text: string; disabled?: boolean };

// La librería no acepta llaves vacías: "" (p. ej. "Todos") se guarda con este marcador.
const EMPTY = "__vacío__";
const toKey = (v: string) => (v === "" ? EMPTY : v);
const fromKey = (k: string) => (k === EMPTY ? "" : k);

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Lee los <option> hijos (también dentro de arreglos y fragmentos). */
function collectOptions(children: ReactNode, out: Option[] = []): Option[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const props = (child as ReactElement<OptionProps>).props;
      const text = textOf(props.children);
      const value = props.value === undefined ? text : String(props.value);
      out.push({ key: toKey(value), value, label: props.children, text, disabled: props.disabled });
    } else {
      collectOptions((child as ReactElement<{ children?: ReactNode }>).props.children, out);
    }
  });
  return out;
}

/**
 * Select de HeroUI con la misma forma de uso que un <select> nativo:
 * hijos <option>, value/defaultValue, name (para formularios) y
 * onChange={(e) => e.target.value}.
 */
export function AppSelect({
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  required,
  fullWidth,
  variant,
  className,
  children,
  placeholder = "Elegir…",
  id,
  title,
  "aria-label": ariaLabel,
}: {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: SelectChangeEvent) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
  placeholder?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const options = collectOptions(children);
  return (
    <Select
      id={id}
      name={name}
      aria-label={ariaLabel ?? title}
      placeholder={placeholder}
      isDisabled={disabled}
      isRequired={required}
      fullWidth={fullWidth}
      variant={variant}
      className={className}
      disabledKeys={options.filter((o) => o.disabled).map((o) => o.key)}
      {...(value !== undefined ? { value: toKey(String(value)) } : {})}
      {...(defaultValue !== undefined ? { defaultValue: toKey(String(defaultValue)) } : {})}
      onChange={(key) => {
        if (key === null || Array.isArray(key)) return;
        const v = fromKey(String(key));
        onChange?.({ target: { value: v, name }, currentTarget: { value: v, name } });
      }}
    >
      <Select.Trigger className="whitespace-nowrap">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="max-h-80">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.key} id={o.key} textValue={o.text}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
