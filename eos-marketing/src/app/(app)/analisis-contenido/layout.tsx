import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/analisis-contenido">) {
  return <ModuleGate module="analisis_contenido">{children}</ModuleGate>;
}
