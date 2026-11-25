"use client";

import { PageHeader } from "@/components/app/PageHeader";
import { useStaffContext } from "@/components/app/StaffProvider";
import { DoctorAlerts } from "@/components/clinic/DoctorAlerts";
import { DoctorScope } from "@/components/clinic/DoctorScope";
import { TokenBoard } from "@/components/clinic/TokenBoard";
import { Panel } from "@/components/ui/Panel";
import { useBoard } from "@/hooks/useBoard";

/**
 * The receptionist's token board as a page: the doctor's status (which callers hear), today's
 * queue, later bookings, and what reached the doctor. Calls book tokens into it as they happen.
 */
export function AppointmentsPage() {
  const staff = useStaffContext();
  const board = useBoard(staff.failed);
  const profile = board.system?.clinic_profile;

  return (
    <>
      <PageHeader title="Appointments">
        The token board for {profile?.name ?? "the clinic"}. Every token a caller hears comes from here, and the doctor&apos;s
        status is what Parchi tells callers. It refreshes every few seconds.
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start" data-testid="appointments">
        <Panel eyebrow={`${profile?.receptionist ?? "The receptionist"}'s board`} title="Today" testId="appointments-board">
          <TokenBoard desk={board} />
        </Panel>
        <div className="min-w-0 space-y-4">
          <Panel eyebrow="Today" title="What reached the doctor" testId="appointments-alerts">
            <DoctorAlerts alerts={board.clinic?.alerts ?? []} />
          </Panel>
          {profile && (
            <Panel eyebrow="Changed in Settings" title="What the doctor treats" testId="appointments-scope">
              <DoctorScope profile={profile} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
