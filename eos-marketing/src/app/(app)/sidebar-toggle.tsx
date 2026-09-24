"use client";

import { usePathname } from "next/navigation";
import { LayoutSideContentLeft } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { currentSection } from "./nav";
import { useShell } from "./shell";

/** Botón para mostrar u ocultar el menú, y el nombre de la sección actual. */
export function SidebarToggle() {
  const { toggleSidebar, collapsed } = useShell();
  const section = currentSection(usePathname());
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
        onPress={toggleSidebar}
      >
        <LayoutSideContentLeft />
      </Button>
      {section && <span className="truncate font-semibold">{section.label}</span>}
    </div>
  );
}
