import type { Metadata } from "next";
import { OverviewPage } from "@/components/overview/OverviewPage";

export const metadata: Metadata = { title: "Overview · Parchi" };

export default function Overview() {
  return <OverviewPage />;
}
