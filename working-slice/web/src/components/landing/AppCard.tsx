import Link from "next/link";
import { Icon } from "@/components/app/Icon";

const BADGE = "flex items-center gap-2 rounded-xl bg-night px-3 py-2 text-white transition-[filter,transform] hover:brightness-125 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris";

/**
 * Where the reference has "Download our mobile app" with two store badges: Parchi needs no
 * download, so the two badges open the live demo and the staff app.
 */
export function AppCard({ className = "" }: { className?: string }) {
  return (
    <div className={`arrive w-full max-w-[320px] rounded-[22px] bg-frost p-4 shadow-xl shadow-night/10 ring-1 ring-iris-wash ${className}`}
      style={{ animationDelay: "1.6s" }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-night">
          Open our app
          <span className="block text-[13px] font-medium text-night-soft">On any phone. Nothing to download.</span>
        </p>
        <span aria-hidden lang="hi" className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-linear-to-br from-iris to-orchid text-[16px] font-semibold text-white shadow-md shadow-iris/30">
          प
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/demo/" data-testid="hero-demo-link" className={BADGE}>
          <Icon name="play" className="size-5" />
          <span className="text-left leading-none">
            <span className="block text-[9.5px] font-medium opacity-75">Try it now</span>
            <span className="block text-[14px] font-semibold">Live demo</span>
          </span>
        </Link>
        <Link href="/app/" data-testid="hero-app-link" className={BADGE}>
          <Icon name="shield" className="size-5" />
          <span className="text-left leading-none">
            <span className="block text-[9.5px] font-medium opacity-75">For the clinic</span>
            <span className="block text-[14px] font-semibold">Staff sign-in</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
