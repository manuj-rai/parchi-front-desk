import type { IconName } from "./Icon";

/** The app's pages, in sidebar order. Each has one job. */
export const NAV: { href: string; label: string; icon: IconName; testId: string; about: string }[] = [
  { href: "/app/", label: "Overview", icon: "overview", testId: "nav-overview",
    about: "Today at a glance: what needs the doctor first, and what is happening now." },
  { href: "/app/calls/", label: "Calls", icon: "calls", testId: "nav-calls",
    about: "Every call with its recording and transcript. Review them, or join one that is live." },
  { href: "/app/appointments/", label: "Appointments", icon: "appointments", testId: "nav-appointments",
    about: "The token board: the doctor's status, today's queue and later bookings." },
  { href: "/app/test-lab/", label: "Test lab", icon: "lab", testId: "nav-test-lab",
    about: "Check that Parchi still handles the brief's calls, and play a caller yourself." },
  { href: "/app/settings/", label: "Settings", icon: "settings", testId: "nav-settings",
    about: "The clinic's details, who can sign in, and what this server runs with." },
];

/** The page a path belongs to; paths may arrive with or without the trailing slash. */
export function pageFor(pathname: string) {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return [...NAV].reverse().find((item) => path.startsWith(item.href)) ?? NAV[0];
}
