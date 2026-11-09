import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/analisis">) {
  return <ModuleGate module="analisis" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
