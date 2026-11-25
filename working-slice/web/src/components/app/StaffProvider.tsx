"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type Staff, useStaff } from "@/hooks/useStaff";

const StaffContext = createContext<Staff | null>(null);

/** One sign-in and one call log for every page of the app, kept as the user moves between them. */
export function StaffProvider({ children }: { children: ReactNode }) {
  const staff = useStaff();
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

export function useStaffContext(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useStaffContext must be used inside <StaffProvider>");
  return staff;
}
