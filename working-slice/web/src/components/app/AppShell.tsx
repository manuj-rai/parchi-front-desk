"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignIn } from "@/components/dashboard/SignIn";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { Icon } from "./Icon";
import { useStaffContext } from "./StaffProvider";

/**
 * The signed-in app: a sidebar on wide screens (a drawer on small ones), a top bar, and the
 * page. Signed out, every page shows the sign-in card instead, and returns to that page after.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const staff = useStaffContext();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const closeButton = useRef<HTMLButtonElement>(null);

  // A notice ("Added 8 test calls") is news, not a fixture: it goes after a few seconds.
  const { notice, dismiss, user } = staff;
  useEffect(() => {
    if (!notice || !user) return;
    const timer = window.setTimeout(dismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss, user]);

  // The drawer closes on navigation and on Escape; it takes focus when it opens.
  useEffect(() => {
    if (!drawer) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  if (staff.user === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-lilac text-[14px] text-night-soft" data-testid="app-checking">
        Checking your sign-in…
      </div>
    );
  }
  if (staff.user === null) {
    return <SignIn accounts={staff.accounts} error={staff.error} notice={staff.notice} onSignIn={staff.login} />;
  }

  return (
    <div className="min-h-dvh bg-lilac lg:pl-[272px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] p-3 sm:p-4 lg:block" aria-label="Sidebar">
        <AppSidebar />
      </aside>

      {drawer && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-40 lg:hidden" data-testid="app-drawer">
          <button type="button" aria-label="Close the menu" tabIndex={-1} className="absolute inset-0 bg-night/30 backdrop-blur-sm"
            onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(300px,86vw)] p-3">
            <button
              ref={closeButton}
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close the menu"
              data-testid="app-drawer-close"
              className="absolute right-6 top-6 z-10 grid size-9 place-items-center rounded-full bg-haze text-night focus-visible:outline-2 focus-visible:outline-iris"
            >
              <Icon name="close" className="size-4" />
            </button>
            <AppSidebar key={pathname} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-dvh min-w-0 flex-col">
        <AppTopbar onMenu={() => setDrawer(true)} />
        {staff.error && (
          <p role="alert" className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-stamp-wash px-4 py-2.5 text-[13px] font-medium text-stamp ring-1 ring-stamp/20 sm:mx-4" data-testid="dashboard-error">
            <span className="flex-1">{staff.error}</span>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-7 place-items-center rounded-full hover:bg-frost focus-visible:outline-2 focus-visible:outline-iris">
              <Icon name="close" className="size-3.5" />
            </button>
          </p>
        )}
        {staff.notice && (
          <p role="status" className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-wall-wash px-4 py-2.5 text-[13px] font-medium text-wall sm:mx-4" data-testid="dashboard-notice">
            <span className="flex-1">{staff.notice}</span>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-7 place-items-center rounded-full hover:bg-frost focus-visible:outline-2 focus-visible:outline-iris">
              <Icon name="close" className="size-3.5" />
            </button>
          </p>
        )}
        <main className="min-w-0 flex-1 px-3 pb-8 sm:px-4">{children}</main>
      </div>
    </div>
  );
}
