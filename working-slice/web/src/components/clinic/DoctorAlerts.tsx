import type { Alert } from "@/lib/types";

/** What reaches the doctor's WhatsApp: urgent cases first in colour, callbacks and questions after. */
export function DoctorAlerts({ alerts, className = "" }: { alerts: Alert[]; className?: string }) {
  return (
    <div className={`p-4 ${className}`} data-testid="doctor-alerts">
      <h3 className="text-[13px] font-semibold text-night">Doctor&apos;s WhatsApp</h3>
      {/* Always rendered, so screen readers announce each new alert. */}
      <div aria-live="polite">
        {alerts.length ? (
          <ul className="mt-3 space-y-2">
            {alerts.map((alert, index) => {
              const urgent = alert.kind.startsWith("URGENT");
              return (
                <li
                  key={`${alert.at}-${index}`}
                  data-testid={urgent ? "alert-urgent" : "alert"}
                  className={`rounded-2xl p-3 ring-1 ${urgent ? "bg-stamp-wash ring-stamp/20" : "bg-haldi-wash ring-haldi/15"}`}
                >
                  <p className={`flex items-center justify-between gap-2 text-[12px] font-semibold ${urgent ? "text-stamp" : "text-haldi"}`}>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className={`size-1.5 rounded-full ${urgent ? "bg-stamp" : "bg-haldi"}`} />
                      {alert.kind}
                    </span>
                    <time className="font-medium tabular-nums text-night-faint">{alert.at}</time>
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-night">{alert.text}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-night-faint">Nothing yet. Urgent cases, callbacks and medical questions arrive here.</p>
        )}
      </div>
    </div>
  );
}
