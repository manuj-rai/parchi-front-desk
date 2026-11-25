import { DemoLink } from "./DemoLink";
import { SectionHeading } from "./SectionHeading";
import { StatCard } from "./StatCard";

/** Every figure here is from the Parchi brief, as cited in the decision memo and cost sheet. */
export function ProblemSection() {
  return (
    <section id="problem" className="scroll-mt-6 px-5 py-16 sm:px-10 sm:py-20">
      <SectionHeading title="The Phone Rings When Nobody Can Answer It">
        A small clinic’s calls come in a rush, while the receptionist has patients in front of her. Figures from the Parchi brief.
      </SectionHeading>
      <div className="mt-10 grid gap-4 md:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.95fr)] xl:items-stretch">
        <StatCard value="44%" note="Parchi answers it in the greeting, before the caller has to ask: from the receptionist’s token board, in audio made in advance.">
          of calls and messages ask where the doctor is, or how long the wait will be.
        </StatCard>
        <StatCard value="57%" note="So Parchi reads the real time from the receptionist’s token board, not the board outside.">
          of sessions start more than 30 minutes after the posted time.
        </StatCard>
        <StatCard value="64%" note="The same hours the receptionist is busiest with patients at the desk.">
          of calls and messages arrive between 9 and 11 am or 5 and 7 pm.
        </StatCard>
        <div className="flex flex-col justify-between gap-6 rounded-[24px] p-2 md:col-span-3 md:flex-row md:items-end xl:col-span-1 xl:flex-col xl:items-start">
          <div>
            <p className="text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-night">“Maybe fifteen.”</p>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-night-soft">
              That is how many calls Sunita, a clinic receptionist, says she misses every morning rush. Each one is a patient who may go to the clinic across the road.
            </p>
          </div>
          <DemoLink testId="problem-demo-link" />
        </div>
      </div>
    </section>
  );
}
