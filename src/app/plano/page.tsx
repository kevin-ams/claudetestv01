import type { Metadata } from "next";
import { PlanoClient } from "./plano-client";

export const metadata: Metadata = {
  title: "Plano de iluminación",
  description: "Diseña planos de iluminación y distribución eléctrica para estudios y escenarios.",
};

export default function PlanoPage() {
  return <PlanoClient />;
}
