import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#problem", label: "The problem" },
      { href: "#how", label: "How a call works" },
      { href: "#app", label: "The app" },
      { href: "#measured", label: "What we measured" },
    ],
  },
  {
    title: "Try it",
    links: [
      { href: "/demo/", label: "Live demo" },
      { href: "/app/", label: "Staff sign-in", testId: "footer-dashboard-link" },
      { href: "/app/test-lab/", label: "Test lab" },
    ],
  },
];

/** The foot of the page: where to go next, and what this is. */
export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-dusk px-5 pb-8 pt-12 text-white sm:px-10">
      <div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-orchid/30 blur-3xl" />
      <div className="relative grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.7fr))]">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden lang="hi" className="grid size-9 place-items-center rounded-[11px] bg-linear-to-br from-iris to-orchid text-[17px] font-semibold text-white">
              प
            </span>
            <span className="text-[19px] font-bold tracking-[-0.02em]">Parchi</span>
          </div>
          <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed text-white/70">
            An AI front desk for small clinics: every call answered in Hindi and Hinglish, tokens from the clinic&apos;s own
            board, and danger caught even when it is said in passing.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-[13px] font-semibold text-white/60">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} data-testid={"testId" in link ? link.testId : undefined}
                    className="text-[14px] font-medium text-white/85 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="relative mt-10 border-t border-white/15 pt-5 text-[12.5px] text-white/60">
        A take-home project, November 2026. The clinic, doctor and patients in the demo are made up; the
        hero&apos;s images were made for Parchi with ChatGPT.
      </p>
    </footer>
  );
}
