"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV, pageFor } from "./nav";
import { useStaffContext } from "./StaffProvider";

/** The app's left rail: where you can go, what is waiting, and who is signed in. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const staff = useStaffContext();
  const current = pageFor(usePathname());
  const summary = staff.log?.summary;
  const waiting = summary ? summary.emergencies + summary.needs_attention : 0;
  const user = staff.user;

  return (
    <div className="flex h-full flex-col rounded-[24px] bg-frost/90 p-3 shadow-lg shadow-night/5 ring-1 ring-iris-wash">
      <Link
        href="/"
        onClick={onNavigate}
        aria-label="Parchi: the public website"
        data-testid="app-home-link"
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
      >
        <span aria-hidden lang="hi" className="grid size-9 place-items-center rounded-[11px] bg-linear-to-br from-iris to-orchid text-[17px] font-semibold text-white shadow-md shadow-iris/30">
          प
        </span>
        <span>
          <span className="block text-[17px] font-bold leading-tight tracking-[-0.02em] text-night">Parchi</span>
          <span className="block text-[11.5px] font-medium text-night-faint">AI front desk</span>
        </span>
      </Link>

      <p className="mt-6 px-3 text-[11.5px] font-semibold text-night-faint">Menu</p>
      <nav aria-label="App" className="mt-2 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === current.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-testid={item.testId}
              className={`group relative flex items-center gap-3 rounded-2xl px-2 py-2 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${active ? "bg-linear-to-r from-iris to-orchid text-white shadow-md shadow-iris/25" : "text-night-soft hover:bg-haze hover:text-night"}`}
            >
              {active && <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-iris" />}
              <span aria-hidden className={`grid size-8 place-items-center rounded-xl transition-colors ${active ? "bg-white/20" : "bg-haze group-hover:bg-frost"}`}>
                <Icon name={item.icon} className="size-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/app/calls/" && waiting > 0 && (
                <span
                  className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11.5px] font-bold tabular-nums ${active ? "bg-white/25 text-white" : "bg-stamp-wash text-stamp"}`}
                  data-testid="nav-calls-waiting"
                  aria-label={`${waiting} calls waiting for review`}
                >
                  {waiting}
                </span>
              )}
              {item.href === "/app/calls/" && (summary?.live_now ?? 0) > 0 && (
                <span aria-label="A call is on the line" className="size-2 animate-pulse rounded-full bg-wall" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        <Link
          href="/demo/"
          onClick={onNavigate}
          data-testid="app-simulator-link"
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold text-iris-deep hover:bg-iris-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          <Icon name="globe" className="size-4" />
          Simulator, full screen
        </Link>
        {user && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-haze px-3 py-2.5 ring-1 ring-rule">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-iris-wash text-[14px] font-bold text-iris-deep">
              {user.name.replace(/^Dr\.?\s*/, "")[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-night">{user.name}</span>
              <span className="block text-[12px] text-night-faint">{user.role === "doctor" ? "Doctor" : "Receptionist"}</span>
            </span>
            <button
              type="button"
              onClick={() => void staff.logout()}
              aria-label="Sign out"
              title="Sign out"
              data-testid="dashboard-signout"
              className="grid size-9 place-items-center rounded-full text-night-soft hover:bg-frost hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
              <Icon name="out" className="size-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
