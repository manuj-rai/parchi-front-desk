import Link from "next/link";
import { DemoLink } from "./DemoLink";

const LINKS = [
  { href: "#problem", label: "The problem", testId: "nav-problem" },
  { href: "#how", label: "How a call works", testId: "nav-how" },
  { href: "#measured", label: "What we measured", testId: "nav-measured" },
  { href: "#app", label: "The app", testId: "nav-app" },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-haze/80 px-5 py-3 backdrop-blur-md sm:px-10 sm:py-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          lang="hi"
          className="grid size-9 place-items-center rounded-[11px] bg-linear-to-br from-iris to-orchid text-[17px] font-semibold text-white shadow-md shadow-iris/30"
        >
          प
        </span>
        <span className="text-[19px] font-bold tracking-[-0.02em] text-night">Parchi</span>
      </div>
      <nav aria-label="Sections" className="hidden items-center gap-1 rounded-full bg-frost/85 p-1 shadow-sm shadow-night/5 ring-1 ring-iris-wash md:flex">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            data-testid={link.testId}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium text-night-soft transition-colors hover:bg-iris-wash hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href="/app/"
          data-testid="nav-signin"
          className="hidden rounded-full px-3 py-2 text-[13px] font-semibold text-night-soft hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:inline-flex"
        >
          Sign in
        </Link>
        <DemoLink testId="nav-demo-link" size="sm" />
      </div>
    </header>
  );
}
