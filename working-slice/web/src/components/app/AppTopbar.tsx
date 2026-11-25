"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "./Icon";
import { pageFor } from "./nav";
import { useStaffContext } from "./StaffProvider";

/** Above every page: where you are, whether a call is live, which mode the server is in. */
export function AppTopbar({ onMenu }: { onMenu: () => void }) {
  const staff = useStaffContext();
  const page = pageFor(usePathname());
  const live = staff.log?.summary.live_now ?? 0;
  const testMode = staff.accounts?.test_mode ?? false;

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="flex min-h-14 items-center gap-3 rounded-[20px] bg-frost/90 px-3 py-2 shadow-sm shadow-night/5 ring-1 ring-iris-wash backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open the menu"
          data-testid="app-menu"
          className="grid size-10 place-items-center rounded-full text-night hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <p className="min-w-0 truncate text-[15px] font-semibold text-night" data-testid="app-page-name">{page.label}</p>
        <div className="ml-auto flex items-center gap-2">
          {live > 0 && (
            <Link href="/app/calls/" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris" data-testid="app-live-link">
              <Chip tone="wall">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-wall" />
                {live} on the line
              </Chip>
            </Link>
          )}
          {staff.accounts && (
            <span className="hidden sm:inline-flex">
              <Chip tone={testMode ? "haldi" : "wall"} testId="app-mode">{testMode ? "Offline test mode" : "Live models"}</Chip>
            </span>
          )}
          {staff.user && (
            <span className="hidden text-[13px] text-night-soft md:inline" data-testid="dashboard-user">
              <span className="font-semibold text-night">{staff.user.name}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
