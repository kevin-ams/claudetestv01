"use client";

import { Button } from "@heroui/react";

export function BotonImprimir() {
  return (
    <Button onPress={() => window.print()} className="print:hidden">
      Imprimir / Guardar PDF
    </Button>
  );
}
