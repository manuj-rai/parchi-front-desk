"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { clock } from "@/lib/days";
import type { CallDetail, Role } from "@/lib/types";

interface ReviewBoxProps {
  call: CallDetail;
  role: Role;
  onReview: (note: string) => Promise<void>;
}

/** The doctor's final review of a call. The receptionist can see whether it is done. */
export function ReviewBox({ call, role, onReview }: ReviewBoxProps) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  if (call.reviewed) {
    return (
      <div className="rounded-2xl bg-iris-wash/60 px-4 py-3 ring-1 ring-iris/20" data-testid="review-done">
        <p className="text-[13.5px] font-semibold text-iris-deep">
          Reviewed by {call.reviewed_by} at {call.reviewed_at ? clock(call.reviewed_at) : ""}
        </p>
        {call.review_note && <p className="mt-1 text-[13.5px] text-night">{call.review_note}</p>}
      </div>
    );
  }
  if (call.live) {
    return <p className="text-[13px] text-night-soft" data-testid="review-live">The call is still on the line. Review it when it ends.</p>;
  }
  if (role !== "doctor") {
    return <p className="text-[13px] text-night-soft" data-testid="review-waiting">Waiting for the doctor&apos;s review.</p>;
  }
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        await onReview(note.trim());
        setSending(false);
      }}
    >
      <label htmlFor="review-note" className="text-[12.5px] font-semibold text-night-soft">
        Note for the record (optional)
      </label>
      <textarea
        id="review-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder="e.g. Called him back; he went to hospital."
        data-testid="review-note"
        className="w-full resize-y rounded-2xl bg-frost px-4 py-2.5 text-[14px] text-night outline-none ring-1 ring-rule-strong placeholder:text-night-faint focus:ring-2 focus:ring-iris"
      />
      <Button type="submit" variant="primary" disabled={sending} data-testid="review-submit">
        {sending ? "Saving…" : "Mark as reviewed"}
      </Button>
    </form>
  );
}
