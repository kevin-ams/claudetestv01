import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/calendario">) {
  return <ModuleGate module="calendario">{children}</ModuleGate>;
}
