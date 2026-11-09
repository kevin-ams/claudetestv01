import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/rocks">) {
  return <ModuleGate module="rocks">{children}</ModuleGate>;
}
