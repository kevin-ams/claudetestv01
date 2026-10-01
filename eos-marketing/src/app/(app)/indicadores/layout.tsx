import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/indicadores">) {
  return <ModuleGate module="indicadores">{children}</ModuleGate>;
}
