import type { Metadata } from "next";
import { AppPreview } from "@/components/landing/AppPreview";
import { ClosingCall } from "@/components/landing/ClosingCall";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { MeasuredSection } from "@/components/landing/MeasuredSection";
import { ProblemSection } from "@/components/landing/ProblemSection";

export const metadata: Metadata = { title: "Parchi · An AI front desk for clinics" };

/** The public site: what Parchi is, then the live demo (/demo/) and the staff app (/app/). */
export default function Home() {
  return (
    <div className="min-h-dvh bg-lilac p-2.5 sm:p-5">
      <div className="mx-auto max-w-[1200px] overflow-clip rounded-[32px] bg-haze shadow-2xl shadow-night/15">
        <LandingNav />
        <main>
          <Hero />
          <ProblemSection />
          <HowItWorks />
          <AppPreview />
          <MeasuredSection />
          <ClosingCall />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
