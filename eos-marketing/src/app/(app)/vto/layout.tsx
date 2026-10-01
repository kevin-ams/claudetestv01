import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/vto">) {
  return <ModuleGate module="vto">{children}</ModuleGate>;
}
