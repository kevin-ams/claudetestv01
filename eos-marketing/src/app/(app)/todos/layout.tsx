import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/todos">) {
  return <ModuleGate module="todos">{children}</ModuleGate>;
}
