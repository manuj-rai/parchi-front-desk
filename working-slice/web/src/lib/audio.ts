// Plays one clip at a time. Resolves when the clip ends (or at once if there is no audio,
// as in offline test mode), so callers can wait for Parchi to finish speaking.

let current: HTMLAudioElement | null = null;

export function playClip(base64Audio: string, mime = "audio/mpeg"): Promise<void> {
  current?.pause();
  if (!base64Audio) return Promise.resolve();
  return new Promise((resolve) => {
    const clip = new Audio(`data:${mime};base64,${base64Audio}`);
    current = clip;
    clip.onended = () => resolve();
    clip.onerror = () => resolve();
    clip.play().catch(() => resolve());
  });
}

export function stopClip(): void {
  current?.pause();
  current = null;
}
