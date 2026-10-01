import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/meeting">) {
  return <ModuleGate module="meeting">{children}</ModuleGate>;
}
