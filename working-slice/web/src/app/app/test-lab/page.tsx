import type { Metadata } from "next";
import { TestLabPage } from "@/components/testlab/TestLabPage";

export const metadata: Metadata = { title: "Test lab · Parchi" };

export default function TestLab() {
  return <TestLabPage />;
}
