"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/app/Icon";
import { Button } from "@/components/ui/Button";

interface TestDataCardProps {
  testMode: boolean;
  onAddTestCalls: () => Promise<void>;
}

/** Data to test with: the brief's calls on earlier days, and where to see them. */
export function TestDataCard({ testMode, onAddTestCalls }: TestDataCardProps) {
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="test-data-title" className="rounded-[24px] bg-frost p-5 ring-1 ring-iris-wash" data-testid="testlab-data">
      <h2 id="test-data-title" className="text-[16px] font-bold tracking-[-0.02em] text-night">Test data</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-night-soft">
        The brief&apos;s calls on yesterday and the days before, through the real call flow, marked as test calls. Use them
        to try the call log&apos;s days, queues and review.
      </p>
      <Button
        className="mt-3 w-full"
        disabled={!testMode || adding}
        onClick={async () => {
          setAdding(true);
          await onAddTestCalls();
          setAdding(false);
        }}
        data-testid="dashboard-add-test-calls"
      >
        {adding ? "Adding…" : "Add test calls"}
      </Button>
      {!testMode && (
        <p className="mt-2 text-[12px] text-night-faint">Only in offline test mode, so real call logs never hold test calls.</p>
      )}
      <div className="mt-4 space-y-1.5 border-t border-rule pt-3 text-[13.5px]">
        <Link href="/app/calls/" className="flex items-center gap-2 font-semibold text-iris-deep hover:underline focus-visible:outline-2 focus-visible:outline-iris">
          <Icon name="calls" className="size-4" /> See them in Calls
        </Link>
        <Link href="/demo/" className="flex items-center gap-2 font-semibold text-iris-deep hover:underline focus-visible:outline-2 focus-visible:outline-iris">
          <Icon name="globe" className="size-4" /> Open the simulator full screen
        </Link>
      </div>
    </section>
  );
}
