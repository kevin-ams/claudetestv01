"use client";

import { Display, Moon, Sun } from "@gravity-ui/icons";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { setThemeMode, useFollowSystemTheme, useIsDark, useThemeMode } from "@/lib/theme-client";
import type { ThemeMode } from "@/lib/theme";

const OPTIONS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Oscuro", Icon: Moon },
  { id: "system", label: "Sistema", Icon: Display },
];

/** Selector Claro / Oscuro / Sistema. La preferencia es de cada persona. */
export function ThemeModePicker() {
  const mode = useThemeMode();
  return (
    <ToggleButtonGroup
      aria-label="Modo de color"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next) setThemeMode(next as ThemeMode);
      }}
    >
      {OPTIONS.map(({ id, label, Icon }, i) => (
        <ToggleButton key={id} id={id}>
          {i > 0 && <ToggleButtonGroup.Separator />}
          <Icon />
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** Botón rápido de la barra superior: alterna entre claro y oscuro. */
export function ThemeToggleButton() {
  useFollowSystemTheme();
  const dark = useIsDark();
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onPress={() => setThemeMode(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
