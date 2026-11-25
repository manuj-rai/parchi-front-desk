import { useId } from "react";
import { Chip } from "@/components/ui/Chip";

interface SettingsFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  maxLength: number;
  testId: string;
  hint?: string;
  multiline?: boolean;
  spoken?: boolean;          // callers hear this word for word
  invalid?: string | null;   // why the value cannot be saved, shown under the field
  inputMode?: "text" | "numeric";
}

/** One labelled setting. Marked when callers hear it, because then every word matters. */
export function SettingsField({
  label, value, onChange, disabled, maxLength, testId, hint, multiline = false, spoken = false, invalid = null, inputMode = "text",
}: SettingsFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = invalid || hint ? hintId : undefined;
  const box = `w-full rounded-2xl bg-frost px-3.5 text-[14px] text-night outline-none ring-1 transition-shadow placeholder:text-night-faint focus:ring-2 disabled:bg-haze disabled:text-night-soft ${invalid ? "ring-stamp focus:ring-stamp" : "ring-rule-strong focus:ring-iris"}`;
  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-night-soft">{label}</label>
        {spoken && <Chip tone="iris">Callers hear this</Chip>}
      </div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          rows={3}
          aria-invalid={Boolean(invalid)}
          aria-describedby={describedBy}
          data-testid={testId}
          className={`${box} mt-1.5 resize-y py-2.5 leading-snug`}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete="off"
          aria-invalid={Boolean(invalid)}
          aria-describedby={describedBy}
          data-testid={testId}
          className={`${box} mt-1.5 h-10`}
        />
      )}
      {(invalid || hint) && (
        <p id={hintId} className={`mt-1 text-[12px] ${invalid ? "text-stamp" : "text-night-faint"}`}>
          {invalid ?? hint}
        </p>
      )}
    </div>
  );
}
