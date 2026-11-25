import type { Metadata } from "next";
import { FrontDeskConsole } from "@/components/console/FrontDeskConsole";

export const metadata: Metadata = { title: "Parchi · Front desk console" };

export default function Demo() {
  return <FrontDeskConsole />;
}
