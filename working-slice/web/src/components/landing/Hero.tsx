import Image from "next/image";
import { AppCard } from "./AppCard";
import { HeroDoctorCard } from "./HeroDoctorCard";
import { LanguageChip } from "./LanguageChip";
import { RingCard } from "./RingCard";
import { VoicePill } from "./VoicePill";

/**
 * The hero, laid out as the user's reference: the headline, centred, with a pill set into it; an AI head
 * in the centre below it, joined by thin lines to a chip on the left and the 24/7 card on the right; a
 * doctor on a purple card with a line of text below; the app card at the bottom right.
 * From xl up the pieces are placed as in the reference; below that they stack.
 * Images: made for Parchi with ChatGPT (see public/hero/CREDITS.md); none is taken from the reference.
 */
export function Hero() {
  return (
    <section className="relative">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0" />
      <div className="relative px-5 pb-14 pt-8 sm:px-10 xl:h-[760px] xl:pb-0">
        <h1 className="relative z-10 mx-auto max-w-[14ch] text-center text-[40px] font-bold leading-[1.04] tracking-[-0.035em] text-night sm:text-[60px] xl:absolute xl:inset-x-0 xl:top-6 xl:max-w-none xl:text-[76px]">
          Every Call <VoicePill /> Answered,
          <br className="hidden xl:block" /> Even In The Morning Rush
        </h1>

        {/* The AI head, centre. */}
        <div className="relative mx-auto mt-6 w-full max-w-[420px] xl:absolute xl:left-[350px] xl:top-[205px] xl:mt-0 xl:w-[500px] xl:max-w-none">
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-iris/25 blur-3xl" />
          <Image src="/hero/robot.webp" alt="" width={838} height={900} priority
            className="arrive relative h-auto w-full [mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
            style={{ animationDelay: "0.2s" }} />
        </div>

        {/* Thin connector lines, as in the reference: chip to head, head to the 24/7 card. */}
        <svg aria-hidden viewBox="0 0 1120 760" className="pointer-events-none absolute inset-x-10 top-0 hidden h-[760px] w-[1120px] xl:block" fill="none">
          <path d="M262 300 H 380 V 358 H 420" className="stroke-night/40" strokeWidth="1.3" />
          <circle cx="420" cy="358" r="3.5" className="fill-night/50" />
          <path d="M780 475 H 800 V 420 H 822" className="stroke-night/40" strokeWidth="1.3" />
          <circle cx="780" cy="475" r="3.5" className="fill-night/50" />
        </svg>

        {/* Left: the chip, the doctor on the purple card, and the line of text. */}
        <div className="relative mt-8 flex flex-col items-center gap-5 text-center xl:absolute xl:left-[60px] xl:top-[280px] xl:mt-0 xl:items-start xl:text-left">
          <LanguageChip />
          <HeroDoctorCard />
          <p className="max-w-[28ch] text-[15px] leading-relaxed text-night-soft">
            Answers the clinic&apos;s own number in Hindi or Hinglish, gives tokens from the receptionist&apos;s board, and
            hands anything unsure to a person.
          </p>
        </div>

        {/* Right: the 24/7 card, and the app card at the bottom right. */}
        <div className="relative mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-center xl:static xl:mt-0">
          <RingCard className="xl:absolute xl:left-[862px] xl:top-[265px]" />
          <AppCard className="xl:absolute xl:right-10 xl:top-[590px]" />
        </div>
      </div>
    </section>
  );
}
