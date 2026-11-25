import { CallSteps } from "./CallSteps";
import { PromisesCard } from "./PromisesCard";
import { SectionHeading } from "./SectionHeading";

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-6 px-5 py-16 sm:px-10 sm:py-20">
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-center xl:gap-14">
        <div>
          <SectionHeading title="Two Agents Hear Every Sentence">
            Danger is often said in passing, in the middle of a booking. So one agent handles the request while another listens only for that.
          </SectionHeading>
          <CallSteps />
        </div>
        <PromisesCard />
      </div>
    </section>
  );
}
