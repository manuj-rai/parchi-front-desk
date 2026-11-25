import { DemoLink } from "./DemoLink";
import { SectionHeading } from "./SectionHeading";
import { WhatsAppPhone } from "./WhatsAppPhone";

const PAGES = [
  { name: "Overview", about: "Emergencies and questions waiting for you, and what callers hear now." },
  { name: "Calls", about: "Every call with its recording and transcript, for your review. Join a live one." },
  { name: "Appointments", about: "The token board your receptionist runs, with every booking callers made." },
  { name: "Test lab", about: "Play a caller, and check Parchi still handles the brief's calls." },
  { name: "Settings", about: "Your fees, timings, what you treat, and your own 'see today' rule." },
];

/** A small, drawn picture of the app: not a screenshot, so it never goes out of date silently. */
function AppMock() {
  return (
    <div aria-hidden className="w-full max-w-[560px] rounded-[26px] bg-lilac/70 p-2.5 shadow-2xl shadow-night/15 ring-1 ring-iris-wash">
      <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2.5">
        <div className="rounded-[18px] bg-frost p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="grid size-5 place-items-center rounded-md bg-linear-to-br from-iris to-orchid text-[10px] text-white">प</span>
            <span className="text-[11px] font-bold text-night">Parchi</span>
          </div>
          {PAGES.map((page, index) => (
            <p key={page.name} className={`mt-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${index === 0 ? "bg-linear-to-r from-iris to-orchid text-white" : "text-night-soft"}`}>
              {page.name}
            </p>
          ))}
        </div>
        <div className="space-y-2 rounded-[18px] bg-haze p-2.5">
          <p className="text-[13px] font-bold text-night">Good morning, Dr. Sharma</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[["Emergencies", "1", "text-stamp bg-stamp-wash"], ["Need attention", "2", "text-haldi bg-haldi-wash"], ["Calls today", "14", "text-night bg-frost"]].map(([label, value, look]) => (
              <div key={label} className={`rounded-xl px-2 py-1.5 ${look}`}>
                <p className="text-[9px] font-semibold text-night-soft">{label}</p>
                <p className="text-[17px] font-bold leading-none">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-stamp-wash p-2">
            <p className="text-[10px] font-semibold text-stamp">Emergencies</p>
            <p className="mt-1 rounded-lg bg-frost px-2 py-1 text-[10px] text-night">
              <span className="font-semibold">Ramesh</span> · chest pain, said in passing
            </p>
          </div>
          <div className="rounded-xl bg-frost p-2">
            <p className="text-[10px] font-semibold text-night">Latest calls</p>
            {["09:42  Kavita, booked token 4", "09:40  Sunil, the doctor's status", "09:37  Number withheld, fees"].map((line) => (
              <p key={line} className="mt-1 border-t border-rule pt-1 text-[10px] text-night-soft">{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The app, for the doctor and the receptionist: what is in it, and a picture of it. */
export function AppPreview() {
  return (
    <section id="app" className="scroll-mt-6 px-5 py-16 sm:px-10 sm:py-20" data-testid="landing-app">
      <div className="grid gap-12 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] xl:items-center">
        <div>
          <SectionHeading title="One Page For The Whole Front Desk">
            The doctor and the receptionist sign in on any phone or computer. Urgent cases still reach the doctor on
            WhatsApp at once; the app is where every call can be checked.
          </SectionHeading>
          <ul className="mt-8 space-y-3">
            {PAGES.map((page) => (
              <li key={page.name} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-linear-to-br from-iris to-orchid" />
                <p className="text-[15px] leading-relaxed text-night-soft">
                  <span className="font-semibold text-night">{page.name}.</span> {page.about}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <DemoLink testId="app-section-link" href="/app/" size="lg">Open the app</DemoLink>
          </div>
        </div>
        <div className="relative flex justify-center pb-10 md:pb-0">
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orchid/20 blur-3xl" />
          <AppMock />
          <WhatsAppPhone className="absolute -bottom-6 right-0 hidden scale-[0.78] origin-bottom-right md:block" />
        </div>
      </div>
    </section>
  );
}
