import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/ajustes">) {
  return <ModuleGate module="ajustes" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
