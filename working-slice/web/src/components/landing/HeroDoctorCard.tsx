import Image from "next/image";

/** The doctor on a purple card, as in the reference: the photo stands on the card and rises above it. */
export function HeroDoctorCard() {
  return (
    <div className="arrive relative h-[230px] w-[230px]" style={{ animationDelay: "0.6s" }}>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[180px] rounded-[30px_30px_30px_70px] bg-linear-to-br from-iris to-orchid shadow-xl shadow-iris/30" />
      <div aria-hidden className="absolute -right-3 top-12 size-14 rounded-full bg-orchid/40 blur-xl" />
      <Image src="/hero/doctor.webp" alt="" width={486} height={780}
        className="absolute bottom-0 left-1/2 h-[250px] w-auto max-w-none -translate-x-1/2" />
    </div>
  );
}
