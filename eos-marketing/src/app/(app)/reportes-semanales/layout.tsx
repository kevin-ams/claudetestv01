import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/reportes-semanales">) {
  return <ModuleGate module="reportes_semanales" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
