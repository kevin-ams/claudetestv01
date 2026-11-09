import { ModuleGate } from "@/components/module-gate";

export default function Layout({ children }: LayoutProps<"/scorecard">) {
  return <ModuleGate module="scorecard">{children}</ModuleGate>;
}
