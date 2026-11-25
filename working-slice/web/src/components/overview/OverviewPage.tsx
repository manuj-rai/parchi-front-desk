"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@/components/app/Icon";
import { PageHeader } from "@/components/app/PageHeader";
import { useStaffContext } from "@/components/app/StaffProvider";
import { PriorityQueue } from "@/components/dashboard/PriorityQueue";
import { SummaryTiles } from "@/components/dashboard/SummaryTiles";
import { useBoard } from "@/hooks/useBoard";
import { BoardCard } from "./BoardCard";
import { RecentCalls } from "./RecentCalls";
import { WeekChart } from "./WeekChart";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Today at a glance: what needs the doctor first, the board, and the latest calls. */
export function OverviewPage() {
  const staff = useStaffContext();
  const board = useBoard(staff.failed);
  const router = useRouter();
  const open = useCallback((id: string) => router.push(`/app/calls/?call=${id}`), [router]);
  const log = staff.log;

  const unreviewed = log?.calls.filter((call) => !call.reviewed) ?? [];
  const emergencies = unreviewed.filter((call) => call.priority === "emergency" || call.priority === "see_today");
  const attention = unreviewed.filter((call) => call.priority === "attention");

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${staff.user?.name ?? ""}`}
        actions={
          <>
            <Link href="/app/test-lab/" data-testid="overview-test-lab"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-frost px-4 text-[14px] font-semibold text-night ring-1 ring-rule-strong hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris">
              <Icon name="lab" className="size-4" /> Test lab
            </Link>
            <Link href="/app/calls/" data-testid="overview-calls"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-r from-iris to-orchid px-4 text-[14px] font-semibold text-white shadow-md shadow-iris/25 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris">
              Review calls <Icon name="arrow" className="size-4" />
            </Link>
          </>
        }
      >
        What needs you first, what callers are hearing now, and the latest calls.
      </PageHeader>

      {log ? (
        <div className="space-y-4" data-testid="overview">
          <SummaryTiles summary={log.summary} />
          <div className="grid gap-4 xl:grid-cols-3">
            <PriorityQueue
              title="Emergencies"
              tone="stamp"
              calls={emergencies.slice(0, 4)}
              today={log.today}
              empty="None waiting. Calls with an emergency sign, or a child to be seen today, appear here first."
              selectedId={null}
              onSelect={open}
              testId="overview-emergencies"
            />
            <PriorityQueue
              title="Needs attention"
              tone="haldi"
              calls={attention.slice(0, 4)}
              today={log.today}
              empty="None waiting. Questions for the doctor and callbacks appear here."
              selectedId={null}
              onSelect={open}
              testId="overview-attention"
            />
            <BoardCard clinic={board.clinic} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <WeekChart calls={log.calls} today={log.today} />
            <RecentCalls calls={log.calls.slice(0, 6)} today={log.today} onOpen={open} />
          </div>
        </div>
      ) : (
        <div className="space-y-4" aria-hidden>
          <div className="h-24 animate-pulse rounded-[20px] bg-frost/60" />
          <div className="h-64 animate-pulse rounded-[24px] bg-frost/60" />
        </div>
      )}
    </>
  );
}
