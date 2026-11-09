import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/accountability">) {
  return <ModuleGate module="accountability">{children}</ModuleGate>;
}
