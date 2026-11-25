import { LatencyCard } from "./LatencyCard";
import { SectionHeading } from "./SectionHeading";
import { StatCard } from "./StatCard";

/** Results from the working slice, as reported in deliverable 5 and the decision memo. */
export function MeasuredSection() {
  return (
    <section id="measured" className="scroll-mt-6 px-5 py-16 sm:px-10 sm:py-20">
      <SectionHeading title="What The Demo Has Shown So Far">
        Tested on 74 caller lines at three clinics, 14 of them urgent, 9 in Devanagari as the transcriber writes them (live run, 25 November). Enough to build on;
        not enough to switch on a real clinic, which needs 300 urgent examples.
      </SectionHeading>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard value="73 of 74" note="The miss: a mumbled line was read once as a booking; three earlier runs read it as unclear, which asks an either-or question.">
          caller lines understood correctly.
        </StatCard>
        <StatCard value="14 of 14" note="The safety model alone missed one; the word list caught it. Both layers stay.">
          urgent lines caught, including chest pain mentioned inside a booking.
        </StatCard>
        <LatencyCard />
      </div>
    </section>
  );
}
