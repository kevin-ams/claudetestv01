"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ColorSwatchPicker, Input, Label, parseColor } from "@heroui/react";
import { ThemeModePicker } from "@/components/theme/theme-mode-picker";
import { brandVariables, isHexColor, THEME_PRESETS } from "@/lib/theme";
import { saveThemeColorAction, type ThemeResult } from "./actions";

/** Aplica un color en vivo (vista previa) sin guardarlo. */
function previewColor(color: string | null) {
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(brandVariables(color ?? "#000000"))) {
    if (color) style.setProperty(k, v);
    else style.removeProperty(k);
  }
}

export function AppearanceSettings({ color, canEdit }: { color: string; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(color);
  const [hexText, setHexText] = useState(color);
  const [result, setResult] = useState<ThemeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value.toLowerCase() !== color.toLowerCase();

  // Vista previa mientras se elige; al salir de la página se quita.
  useEffect(() => {
    previewColor(dirty ? value : null);
  }, [value, dirty]);
  useEffect(() => () => previewColor(null), []);

  function choose(next: string) {
    setValue(next);
    setHexText(next);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Modo de color</Card.Title>
          <Card.Description>
            Se guarda en este navegador, para ti. &quot;Sistema&quot; sigue la configuración de tu computadora.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ThemeModePicker />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Color del template</Card.Title>
          <Card.Description>
            Color principal de botones, menú y resaltados. Aplica para todo el equipo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <ColorSwatchPicker
            aria-label="Colores sugeridos"
            size="lg"
            value={parseColor(isHexColor(value) ? value : color)}
            onChange={(c) => canEdit && choose(c.toString("hex").toLowerCase())}
          >
            {THEME_PRESETS.map((p) => (
              <ColorSwatchPicker.Item key={p.color} color={p.color} isDisabled={!canEdit} aria-label={p.name}>
                <ColorSwatchPicker.Swatch />
                <ColorSwatchPicker.Indicator />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="custom-color">Color personalizado</Label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-color"
                  type="color"
                  value={isHexColor(value) ? value : color}
                  disabled={!canEdit}
                  onChange={(e) => choose(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                />
                <Input
                  aria-label="Código hexadecimal"
                  className="w-28 font-mono"
                  value={hexText}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    setHexText(t);
                    const hex = t.startsWith("#") ? t : `#${t}`;
                    if (isHexColor(hex)) choose(hex.toLowerCase());
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2" aria-hidden>
              <span className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                Botón
              </span>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">
                Elemento activo
              </span>
              <span className="text-sm font-semibold text-primary">Enlace</span>
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                isDisabled={!dirty}
                isPending={pending}
                onPress={() =>
                  startTransition(async () => {
                    const res = await saveThemeColorAction(value);
                    setResult(res);
                    if (res.ok) router.refresh();
                  })
                }
              >
                {pending ? "Guardando…" : "Guardar color"}
              </Button>
              <Button variant="tertiary" isDisabled={!dirty || pending} onPress={() => choose(color)}>
                Descartar
              </Button>
              {dirty && <span className="text-sm text-muted">Vista previa: aún no se guarda.</span>}
            </div>
          ) : (
            <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
              Solo un administrador puede cambiar el color del template.
            </p>
          )}
          {result && (
            <p role="status" className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>
              {result.ok ? "✓ " : "✕ "}
              {result.message}
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
