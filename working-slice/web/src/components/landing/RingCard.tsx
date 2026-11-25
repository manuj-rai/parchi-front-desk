import { Icon } from "@/components/app/Icon";

// Ticks around a dial, like a clock face: one mark for each hour of the day.
const TICKS = Array.from({ length: 24 }, (_, hour) => hour);

/** The frosted "24/7" card on the hero's right, as in the reference: a dial, an icon, a promise. */
export function RingCard({ className = "" }: { className?: string }) {
  return (
    <div className={`arrive w-[230px] rounded-[26px] bg-frost/80 p-5 text-center shadow-xl shadow-night/10 ring-1 ring-iris-wash backdrop-blur ${className}`}
      style={{ animationDelay: "1.2s" }}>
      <div className="relative mx-auto size-[104px]">
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
          {TICKS.map((hour) => (
            <line key={hour} x1="50" y1="3" x2="50" y2={hour % 6 === 0 ? 13 : 10} strokeWidth={hour % 6 === 0 ? 3 : 2}
              strokeLinecap="round" className="stroke-iris" opacity={0.3 + (hour / 24) * 0.7}
              transform={`rotate(${hour * 15} 50 50)`} />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[24px] font-bold tracking-[-0.03em] text-night">24/7</span>
      </div>
      <div className="relative mx-auto mt-4 grid size-20 place-items-center rounded-[26px] bg-linear-to-br from-haze to-iris-wash shadow-inner ring-1 ring-frost">
        <Icon name="calls" className="size-9 text-iris-deep" />
        <span aria-hidden className="absolute -left-2 -top-2 grid size-7 place-items-center rounded-full bg-linear-to-br from-iris to-orchid text-[16px] font-bold leading-none text-white shadow-md shadow-iris/30">+</span>
      </div>
      <p className="mt-4 bg-linear-to-r from-iris to-orchid bg-clip-text text-[22px] font-bold leading-tight tracking-[-0.02em] text-transparent">
        Answered
      </p>
      <p className="text-[15px] font-medium leading-snug text-night-soft">Status, tokens and fees</p>
    </div>
  );
}
