import type { Metadata } from "next";
import { RedirectTo } from "@/components/app/RedirectTo";

// The dashboard became the app's Calls page; old links and bookmarks still arrive there.
export const metadata: Metadata = { title: "Parchi", robots: { index: false, follow: false } };

export default function Dashboard() {
  return <RedirectTo href="/app/calls/" label="Continue to Calls" />;
}
