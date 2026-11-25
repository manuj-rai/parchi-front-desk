"use client";

import { CallerPanel } from "@/components/call/CallerPanel";
import { ClinicPanel } from "@/components/clinic/ClinicPanel";
import { TurnTrace } from "@/components/trace/TurnTrace";
import { useFrontDesk } from "@/hooks/useFrontDesk";
import { ConsoleHeader } from "./ConsoleHeader";

/**
 * The whole screen: the caller, what Parchi did, and the clinic, as three cards.
 * From xl up they fill one screen side by side, the middle widest because it is what the
 * demo is about. At lg the caller and the trace share a row and the clinic sits below;
 * on a phone they stack.
 */
export function FrontDeskConsole({ embedded = false }: { embedded?: boolean }) {
  const desk = useFrontDesk();
  // Embedded in the app's Test lab: a framed block of fixed height, without the page chrome.
  const frame = embedded
    ? "flex flex-col rounded-[28px] bg-lilac/70 ring-1 ring-iris-wash xl:h-[880px]"
    : "flex min-h-dvh flex-col bg-lilac xl:h-dvh";
  return (
    <div className={frame} data-testid={embedded ? "console-embedded" : undefined}>
      <ConsoleHeader system={desk.system} phase={desk.phase} onSwitchClinic={(id) => void desk.switchClinic(id)} embedded={embedded} />
      {desk.error && (
        <p
          role="alert"
          data-testid="error"
          className="mx-3 mb-3 rounded-2xl bg-stamp-wash px-4 py-2.5 text-[13px] font-medium text-stamp ring-1 ring-stamp/20 sm:mx-4 sm:mb-4"
        >
          {desk.error}
        </p>
      )}
      <main className="grid flex-1 grid-cols-1 gap-3 px-3 pb-3 sm:gap-4 sm:px-4 sm:pb-4 lg:grid-cols-2 xl:min-h-0 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(290px,340px)] xl:grid-rows-[minmax(0,1fr)]">
        <CallerPanel desk={desk} className="h-[min(760px,calc(100dvh-24px))] xl:h-auto" />
        <TurnTrace desk={desk} className="lg:h-[min(760px,calc(100dvh-24px))] xl:h-auto" />
        <ClinicPanel desk={desk} className="lg:col-span-2 xl:col-span-1" />
      </main>
    </div>
  );
}
