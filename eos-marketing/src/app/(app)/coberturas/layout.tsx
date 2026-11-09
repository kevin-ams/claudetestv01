import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/coberturas">) {
  return <ModuleGate module="coberturas">{children}</ModuleGate>;
}
