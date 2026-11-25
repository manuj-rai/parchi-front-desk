"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1280px)";   // Tailwind's xl: where the call detail sits beside the list

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True on screens wide enough to show the call detail beside the list, not over it. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
