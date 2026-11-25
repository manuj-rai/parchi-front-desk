"use client";

import { PageHeader } from "@/components/app/PageHeader";
import { useStaffContext } from "@/components/app/StaffProvider";
import { FrontDeskConsole } from "@/components/console/FrontDeskConsole";
import { ChecksCard } from "./ChecksCard";
import { TestDataCard } from "./TestDataCard";

/** Everything for testing: automatic checks, test data, and a caller you play yourself. */
export function TestLabPage() {
  const staff = useStaffContext();
  const testMode = staff.accounts?.test_mode ?? false;
  return (
    <>
      <PageHeader title="Test lab">
        Check that Parchi still handles the brief&apos;s calls, add test data, and play a caller yourself. Calls you make
        here are real calls: they reach Calls and the board like any other.
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <ChecksCard testMode={testMode} onFailure={staff.failed} />
        <TestDataCard testMode={testMode} onAddTestCalls={staff.addTestCalls} />
      </div>
      <section aria-labelledby="simulator-title" className="mt-6" data-testid="testlab-simulator">
        <h2 id="simulator-title" className="text-[18px] font-bold tracking-[-0.02em] text-night">Call simulator</h2>
        <p className="mb-3 mt-1 max-w-[70ch] text-[13.5px] text-night-soft">
          You are the caller. Pick a number, start a call, then hold to speak, type, or click one of the brief&apos;s calls.
          The middle shows what each agent decided and how long it took; switch clinics in its header.
        </p>
        <FrontDeskConsole embedded />
      </section>
    </>
  );
}
