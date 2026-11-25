import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { StaffProvider } from "@/components/app/StaffProvider";

// The signed-in app. Staff pages are never indexed: they hold patients' calls.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <StaffProvider>
      <AppShell>{children}</AppShell>
    </StaffProvider>
  );
}
