import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/asistente">) {
  return <ModuleGate module="asistente" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
