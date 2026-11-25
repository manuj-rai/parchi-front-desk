// Days as the clinic says them. Dates are YYYY-MM-DD in the clinic's time, from the server.

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

/** "Today", "Yesterday", "Tomorrow", or "Sun 22 Nov". */
export function dayLabel(day: string, today: string): string {
  const gap = Math.round((parts(today).getTime() - parts(day).getTime()) / 86_400_000);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  if (gap === -1) return "Tomorrow";
  const d = parts(day);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

/** 75 as "1 min 15 s". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** An ISO time as HH:MM in the viewer's clock (the server stores UTC). */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
