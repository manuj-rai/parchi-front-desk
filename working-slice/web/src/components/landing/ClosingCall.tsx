import { DemoLink } from "./DemoLink";

export function ClosingCall() {
  return (
    <section className="px-5 pb-10 sm:px-10 sm:pb-12">
      <div className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-iris to-dusk px-7 py-10 text-white sm:px-12 sm:py-12">
        <div aria-hidden className="absolute -bottom-24 -right-10 size-72 rounded-full bg-orchid/50 blur-3xl" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[38px]">See How It Works In Practice</h2>
            <p className="mt-3 max-w-[54ch] text-[15.5px] leading-relaxed text-white/80">
              Speak as a patient, or click one of the brief’s calls. You hear Parchi answer, and see what each agent decided
              and how long each step took.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DemoLink testId="closing-demo-link" variant="light" size="lg" />
            <DemoLink testId="closing-app-link" href="/app/" variant="gradient" size="lg">Open the app</DemoLink>
          </div>
        </div>
      </div>
    </section>
  );
}
