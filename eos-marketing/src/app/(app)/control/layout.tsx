import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/control">) {
  return <ModuleGate module="control">{children}</ModuleGate>;
}
