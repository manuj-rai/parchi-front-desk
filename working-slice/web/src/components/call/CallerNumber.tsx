"use client";

import { useId } from "react";
import { isCallerNumber } from "@/lib/phone";

// Made-up numbers for trying identity by hand: call twice from one and Parchi knows the name.
const TEST_NUMBERS = ["+91 90000 00001", "+91 90000 00005", ""];

interface CallerNumberProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

/** Where the call comes from. On a real line the phone network passes this on. */
export function CallerNumber({ value, onChange, disabled }: CallerNumberProps) {
  const id = useId();
  const valid = isCallerNumber(value);
  return (
    <div>
      <label htmlFor={id} className="text-[12.5px] font-semibold text-night-soft">
        Calling from
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode="tel"
        autoComplete="off"
        maxLength={20}
        placeholder="Number withheld"
        aria-invalid={!valid}
        aria-describedby={`${id}-hint`}
        data-testid="caller-number"
        className={`mt-1.5 h-10 w-full rounded-full bg-frost px-4 text-[14px] tabular-nums text-night outline-none ring-1 transition-shadow placeholder:text-night-faint focus:ring-2 disabled:opacity-60 ${valid ? "ring-rule-strong focus:ring-iris" : "ring-stamp focus:ring-stamp"}`}
      />
      <p id={`${id}-hint`} className={`mt-1.5 text-[12px] ${valid ? "text-night-faint" : "text-stamp"}`} data-testid="caller-number-hint">
        {valid ? "Parchi knows a number it has heard before." : "Use a 10-digit Indian mobile number, like +91 90000 00001."}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Test numbers">
        {TEST_NUMBERS.map((number) => (
          <button
            key={number || "withheld"}
            type="button"
            disabled={disabled}
            onClick={() => onChange(number)}
            aria-pressed={value === number}
            data-testid={`caller-number-${number ? number.slice(-2) : "withheld"}`}
            className={`rounded-full px-3 py-1 text-[12px] font-medium tabular-nums ring-1 transition-colors disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${value === number ? "bg-iris-wash text-iris-deep ring-iris/30" : "bg-frost text-night-soft ring-rule-strong hover:bg-haze"}`}
          >
            {number || "Withheld"}
          </button>
        ))}
      </div>
    </div>
  );
}
