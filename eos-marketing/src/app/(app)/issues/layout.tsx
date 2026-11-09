import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/issues">) {
  return <ModuleGate module="issues">{children}</ModuleGate>;
}
