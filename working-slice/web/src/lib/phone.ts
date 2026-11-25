// The same rule as the server (parchi/call_log.py): a 10-digit Indian mobile, in any usual form.
const MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;

/** True for a number Parchi accepts as a caller's, or empty (the number was withheld). */
export function isCallerNumber(value: string): boolean {
  const digits = value.replace(/[\s\-().]/g, "");
  return digits === "" || MOBILE.test(digits);
}

/** +919000000001 as +91 90000 00001, for people to read. */
export function formatPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
}
