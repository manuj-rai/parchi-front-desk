import type { Metadata } from "next";
import { CallsPage } from "@/components/dashboard/CallsPage";

export const metadata: Metadata = { title: "Calls · Parchi" };

export default function Calls() {
  return <CallsPage />;
}
