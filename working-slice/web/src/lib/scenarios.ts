// Ready-made caller sentences for testing by hand and in the browser tests.
// Calls 1 to 7 are the pilot calls from the brief.

export interface Scenario {
  id: string;
  label: string;
  text: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "call-1", label: "1 · Is the doctor in?", text: "Doctor sahab aa gaye kya?" },
  {
    id: "call-2",
    label: "2 · Child with fever",
    text: "Mera bachcha do saal ka hai, kal raat se 102 bukhar hai. Abhi lana zaroori hai ya shaam tak ruk sakte hain?",
  },
  { id: "call-3", label: "3 · Report ready?", text: "Main Verma bol raha hoon, pichle hafte aaya tha, report aa gayi kya?" },
  {
    id: "call-4",
    label: "4 · Landlord's son",
    text: "Sharma ji ka beta bol raha hoon. Doctor sahab ko bol dena paanch minute mein aa raha hoon.",
  },
  {
    id: "call-5",
    label: "5 · Chest pain in a booking",
    text: "Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai.",
  },
  { id: "call-6", label: "6 · Sales rep", text: "Hello, I am a medical representative. When is the doctor free to meet?" },
  {
    id: "call-7",
    label: "7 · Don't message me",
    text: "Number laga do, mujhe doctor se akele mein milna hai. Is number pe message mat bhejna.",
  },
  { id: "mumbled", label: "Mumbled", text: "haan woh... matlab... kal wala" },
  { id: "robot", label: "Are you a robot?", text: "Aap robot ho kya?" },
  { id: "fees", label: "Fees", text: "Consultation fees kitni hai?" },
  // Appointments: call twice from one number (pick it at the top) to book, then ask or cancel.
  { id: "book-tomorrow", label: "Book for tomorrow", text: "Kal subah ka number laga do" },
  { id: "my-token", label: "What's my number?", text: "Mera number kya tha, kab aana hai?" },
  { id: "cancel", label: "Cancel my token", text: "Aaj nahin aa paunga, mera number cancel kar dijiye" },
  // What the doctor treats decides these: try them at each clinic (the switcher at the top).
  { id: "toothache", label: "Toothache", text: "Daant mein bahut dard hai, number milega?" },
  { id: "child-fever-booking", label: "Child's fever, wants a visit", text: "Bachche ko kal se bukhar hai, dikhana hai" },
  { id: "earache", label: "Earache", text: "Kaan mein dard hai teen din se, number chahiye" },
  { id: "eyes", label: "Red eye", text: "Aankh laal ho gayi hai, dikhana hai" },
];
