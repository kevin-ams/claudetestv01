import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/dashboard-ac">) {
  return <ModuleGate module="dashboard_ac" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
