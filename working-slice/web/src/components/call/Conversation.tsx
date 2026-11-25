"use client";

import { useEffect, useRef } from "react";
import { Chip } from "@/components/ui/Chip";
import type { Entry } from "@/hooks/useFrontDesk";
import { ROUTE_TONE } from "@/lib/labels";
import type { Turn } from "@/lib/types";

interface ConversationProps {
  greeting: string | null;
  turns: Turn[];
  entries: Entry[];
  shownTurnNumber: number;
  onSelect: (index: number) => void;
}

const PARCHI_BUBBLE = "rounded-2xl rounded-tr-md bg-linear-to-br from-iris to-orchid text-white";
const URGENT_BUBBLE = "rounded-2xl rounded-tr-md bg-stamp text-white";
const STAFF_BUBBLE = "rounded-2xl rounded-tr-md bg-dusk text-white";
const CALLER_BUBBLE = "rounded-2xl rounded-tl-md bg-haze text-night ring-1 ring-rule";

/** The call as a chat: the caller on the left; Parchi, or a person who took over, on the right.
 *  Click one of Parchi's turns to inspect it. */
export function Conversation({ greeting, turns, entries, shownTurnNumber, onSelect }: ConversationProps) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // A block body on purpose: newer browsers make scrollIntoView return a Promise,
    // and React treats anything an effect returns as its clean-up function.
    end.current?.scrollIntoView({ block: "end" });
  }, [entries.length, greeting]);

  if (!greeting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center" data-testid="conversation-empty">
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-iris-wash">
          <span className="size-3 rounded-full bg-linear-to-br from-iris to-orchid" />
        </span>
        <p className="max-w-[30ch] text-[13.5px] leading-relaxed text-night-soft">
          Start a call. Parchi answers at once, says who it is and whether the doctor is in, and asks how it can help.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-label="The call so far" data-testid="conversation">
      <li className="flex flex-col items-end px-2">
        <Speaker who="Parchi" />
        <p className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${PARCHI_BUBBLE}`} data-testid="greeting">
          {greeting}
        </p>
      </li>
      {entries.map((entry, position) => {
        if (entry.kind === "turn") {
          const turn = turns[entry.index];
          return turn ? (
            <li key={position}>
              <TurnButton turn={turn} number={entry.index + 1} shown={entry.index + 1 === shownTurnNumber} onSelect={() => onSelect(entry.index)} />
            </li>
          ) : null;
        }
        if (entry.kind === "caller") {
          return (
            <li key={position} className="flex flex-col items-start px-2" data-testid={`relayed-${position}`}>
              <Speaker who="Caller" />
              <p className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${CALLER_BUBBLE}`}>{entry.text}</p>
            </li>
          );
        }
        if (entry.kind === "staff") {
          return (
            <li key={position} className="flex flex-col items-end px-2" data-testid={`staff-line-${position}`}>
              <span className="mb-1 block px-1 text-[11.5px] font-semibold text-dusk">{entry.who}</span>
              <p className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${STAFF_BUBBLE}`}>
                {entry.text ?? "(spoke)"}
              </p>
            </li>
          );
        }
        return (
          <li key={position} className="flex flex-col items-end px-2" data-testid={`handover-${position}`}>
            <Speaker who="Parchi" />
            <p className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${PARCHI_BUBBLE}`}>{entry.text}</p>
          </li>
        );
      })}
      <li ref={end} aria-hidden />
    </ol>
  );
}

function TurnButton({ turn, number, shown, onSelect }: { turn: Turn; number: number; shown: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={shown}
      title="Show this turn inside Parchi"
      data-testid={`turn-${number}`}
      className={`flex w-full flex-col gap-2 rounded-[18px] p-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${shown ? "bg-iris-wash/70 ring-1 ring-iris/25" : "hover:bg-haze"}`}
    >
      <span className="flex flex-col items-start">
        <Speaker who="Caller" />
        <span className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${CALLER_BUBBLE}`}>{turn.transcript}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="mb-1 flex items-center gap-2">
          <Chip tone={ROUTE_TONE[turn.route]}>{turn.route}</Chip>
          <Speaker who="Parchi" inline />
        </span>
        <span
          className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-snug ${turn.route === "urgent" ? URGENT_BUBBLE : PARCHI_BUBBLE}`}
          data-testid={`reply-${number}`}
        >
          {turn.reply}
        </span>
      </span>
    </button>
  );
}

function Speaker({ who, inline = false }: { who: "Parchi" | "Caller"; inline?: boolean }) {
  return (
    <span className={`${inline ? "" : "mb-1 block px-1"} text-[11.5px] font-semibold ${who === "Parchi" ? "text-iris-deep" : "text-night-faint"}`}>
      {who}
    </span>
  );
}
