import type { Metadata } from "next";
import { RoseGarden } from "@/components/rose-garden";

export const metadata: Metadata = {
  title: "Rose Garden",
  description: "The one plan for couples on WeddingVista: Aria, your AI planning assistant, with every planning tool. Free during the pilot.",
};

export default function RoseGardenPage() {
  return <RoseGarden />;
}
