import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/tratos">) {
  return <ModuleGate module="tratos" lockWhenReadOnly={false}>{children}</ModuleGate>;
}
