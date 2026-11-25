"use client";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { FrontDesk } from "@/hooks/useFrontDesk";
import { DoctorAlerts } from "./DoctorAlerts";
import { DoctorScope } from "./DoctorScope";
import { TokenBoard } from "./TokenBoard";

/**
 * Right column: the clinic's side. What the doctor treats, the receptionist's token board,
 * and what reaches the doctor. When the panel spans the full width (lg), the board and the
 * alerts sit side by side.
 */
export function ClinicPanel({ desk, className = "" }: { desk: FrontDesk; className?: string }) {
  const profile = desk.system?.clinic_profile;
  return (
    <Panel
      eyebrow="The clinic"
      title={profile ? `${profile.receptionist}'s token board` : "Token board"}
      testId="clinic-panel"
      className={className}
      aside={
        <Button size="sm" variant="quiet" onClick={() => desk.updateBoard("reset")} data-testid="reset-demo">
          Reset demo
        </Button>
      }
    >
      <div className="flex-1 overflow-y-auto">
        {profile && <DoctorScope profile={profile} />}
        <div className="lg:grid lg:grid-cols-2 xl:block">
          <TokenBoard desk={desk} />
          <DoctorAlerts
            alerts={desk.clinic?.alerts ?? []}
            className="border-t border-rule lg:border-l lg:border-t-0 xl:border-l-0 xl:border-t"
          />
        </div>
      </div>
    </Panel>
  );
}
