"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Type what the caller says, instead of speaking. Used for testing and when there is no microphone. */
export function TypedLine({ enabled, onSay }: { enabled: boolean; onSay: (text: string) => void }) {
  const [text, setText] = useState("");
  const say = () => {
    if (!enabled || !text.trim()) return;
    onSay(text.trim());
    setText("");
  };
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        say();
      }}
    >
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={!enabled}
        placeholder="…or type what the caller says"
        aria-label="What the caller says"
        autoComplete="off"
        data-testid="typed-line"
        className="h-10 min-w-0 flex-1 rounded-full bg-frost px-4 text-[14px] text-night ring-1 ring-rule-strong outline-none transition-shadow placeholder:text-night-faint focus:ring-2 focus:ring-iris disabled:bg-mist disabled:opacity-60"
      />
      <Button type="submit" disabled={!enabled || !text.trim()} data-testid="say-typed">
        Say
      </Button>
    </form>
  );
}
