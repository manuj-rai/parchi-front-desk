import type { Metadata } from "next";
import { AppointmentsPage } from "@/components/appointments/AppointmentsPage";

export const metadata: Metadata = { title: "Appointments · Parchi" };

export default function Appointments() {
  return <AppointmentsPage />;
}
