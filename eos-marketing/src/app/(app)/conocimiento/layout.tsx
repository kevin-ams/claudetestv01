import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/conocimiento">) {
  return <ModuleGate module="conocimiento">{children}</ModuleGate>;
}
