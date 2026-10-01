import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/metas">) {
  return <ModuleGate module="metas">{children}</ModuleGate>;
}
