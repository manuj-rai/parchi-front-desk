/** The doctor's phone: an urgent alert from call 5, as the design sends it on WhatsApp. */
export function WhatsAppPhone({ className = "" }: { className?: string }) {
  return (
    <div className={`w-[230px] rounded-[38px] bg-night p-[7px] shadow-2xl shadow-night/30 ${className}`}>
      <div className="flex h-[430px] flex-col overflow-hidden rounded-[32px] bg-haze">
        <div className="flex items-center gap-2.5 bg-wall px-4 pb-3 pt-7 text-white">
          <span aria-hidden lang="hi" className="grid size-8 place-items-center rounded-full bg-white/20 text-[14px] font-semibold">प</span>
          <span>
            <span className="block text-[13.5px] font-semibold leading-tight">Parchi, Demo Clinic</span>
            <span className="block text-[11px] opacity-80">to Dr. Sharma</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-frost px-3 py-2 text-[12px] leading-snug text-night shadow-sm shadow-night/5">
            <span className="block font-bold text-stamp">URGENT: emergency</span>
            Ramesh, +91 90000 00031: &quot;Subah se seene mein thoda dard hai.&quot; Told to go to hospital now.
          </p>
          <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-frost px-3 py-2 text-[12px] leading-snug text-night shadow-sm shadow-night/5">
            This repeats every 3 minutes until someone says what happened.
          </p>
          <p className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-wall-wash px-3 py-2 text-[12px] leading-snug text-night">
            Called him. He is going to the hospital.
          </p>
          <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-frost px-3 py-2 text-[12px] leading-snug text-night shadow-sm shadow-night/5">
            Noted, with your name and the time.
          </p>
        </div>
      </div>
    </div>
  );
}
