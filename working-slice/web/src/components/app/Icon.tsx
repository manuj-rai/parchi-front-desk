// A small set of line icons, drawn to one 24-unit grid and coloured by the text around them.
const PATHS = {
  overview: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  calls: "M6.6 3.8 9 3l1.6 4-2 1.4a10 10 0 0 0 7 7l1.4-2 4 1.6-.8 2.4a2 2 0 0 1-2.1 1.4A16 16 0 0 1 3.4 5.9 2 2 0 0 1 4.8 3.8Z",
  appointments: "M5 5h14v15H5zM5 9.5h14M9 3v4M15 3v4M8.5 13h2M13.5 13h2M8.5 16.5h2",
  lab: "M9.5 3h5M10.5 3v6.2L5.3 18a1.6 1.6 0 0 0 1.4 2.4h10.6a1.6 1.6 0 0 0 1.4-2.4l-5.2-8.8V3M7.8 14.5h8.4",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2.1-1-.1-1 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6-.1 1 .1 1-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6Z",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  close: "M6 6l12 12M18 6 6 18",
  out: "M15 16.5 19.5 12 15 7.5M19.5 12H9M12 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H12",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z",
  check: "M5 12.5 9.5 17 19 7.5",
  cross: "M7 7l10 10M17 7 7 17",
  play: "M8 5.5v13l10.5-6.5L8 5.5Z",
  arrow: "M5 12h13.5M13 6.5 18.5 12 13 17.5",
  shield: "M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Z",
  server: "M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01",
  building: "M5 20V5.5L12 3l7 2.5V20M9 9h1.5M13.5 9H15M9 12.5h1.5M13.5 12.5H15M10.5 20v-3.5h3V20",
  alert: "M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2h.01",
  flag: "M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
