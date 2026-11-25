"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Role, StaffAccounts } from "@/lib/types";

interface SignInProps {
  accounts: StaffAccounts | null;
  error: string | null;
  notice: string | null;
  onSignIn: (role: Role, password: string) => Promise<void>;
}

const ROLE_LABEL: Record<Role, string> = { doctor: "Doctor", reception: "Receptionist" };

/** The way into the call log. Recordings of patients' calls are behind it. */
export function SignIn({ accounts, error, notice, onSignIn }: SignInProps) {
  const [role, setRole] = useState<Role>("doctor");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const roles = accounts?.roles ?? [];

  return (
    <div className="grid min-h-dvh place-items-center bg-lilac p-4">
      <main className="w-full max-w-[400px] rounded-[28px] bg-frost p-7 shadow-2xl shadow-night/10 ring-1 ring-iris-wash sm:p-8">
        <div className="flex items-center gap-2.5">
          <span aria-hidden lang="hi" className="grid size-9 place-items-center rounded-[11px] bg-linear-to-br from-iris to-orchid text-[17px] font-semibold text-white">
            प
          </span>
          <span className="text-[19px] font-bold tracking-[-0.02em] text-night">Parchi</span>
        </div>
        <h1 className="mt-6 text-[24px] font-bold tracking-[-0.02em] text-night">Sign in to the call log</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-night-soft">
          Every call, with its recording and transcript, for the doctor&apos;s review.
        </p>

        {notice && <p className="mt-4 rounded-2xl bg-haldi-wash px-4 py-2.5 text-[13px] text-haldi" data-testid="signin-notice">{notice}</p>}

        {accounts && roles.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-stamp-wash px-4 py-3 text-[13px] text-stamp" data-testid="signin-unavailable">
            No staff sign-in is set up on this server. Set PARCHI_DOCTOR_PASSWORD_HASH in working-slice/.env
            (make it with <code>python -m parchi.auth hash</code>).
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSending(true);
              await onSignIn(role, password);
              setSending(false);
              setPassword("");
            }}
          >
            <fieldset>
              <legend className="text-[12.5px] font-semibold text-night-soft">I am the</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-full bg-mist p-1">
                {roles.map(({ role: option, name }) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-full px-3 py-2 text-center text-[13.5px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-iris ${role === option ? "bg-frost text-night shadow-sm shadow-night/10" : "text-night-soft hover:text-night"}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option}
                      checked={role === option}
                      onChange={() => setRole(option)}
                      className="sr-only"
                      data-testid={`signin-role-${option}`}
                    />
                    {ROLE_LABEL[option]}
                    <span className="block text-[11.5px] font-medium text-night-faint">{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="staff-password" className="text-[12.5px] font-semibold text-night-soft">Password</label>
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                maxLength={200}
                data-testid="signin-password"
                className="mt-1.5 h-11 w-full rounded-full bg-frost px-4 text-[14px] text-night outline-none ring-1 ring-rule-strong transition-shadow focus:ring-2 focus:ring-iris"
              />
            </div>
            {error && <p role="alert" className="text-[13px] font-medium text-stamp" data-testid="signin-error">{error}</p>}
            <Button type="submit" variant="primary" className="h-11 w-full text-[15px]" disabled={sending || !password} data-testid="signin-submit">
              {sending ? "Signing in…" : "Sign in"}
            </Button>
            {accounts?.test_logins && (
              <p className="rounded-2xl bg-haze px-4 py-3 text-[12.5px] leading-relaxed text-night-soft ring-1 ring-rule" data-testid="signin-test-hint">
                Test mode: the doctor&apos;s password is <code className="font-semibold text-night">doctor-test</code> and the
                receptionist&apos;s is <code className="font-semibold text-night">reception-test</code>. A real clinic sets its own.
              </p>
            )}
          </form>
        )}
        <Link href="/" className="mt-6 inline-block text-[13px] font-semibold text-iris-deep underline decoration-iris/30 underline-offset-4 hover:decoration-iris" data-testid="signin-console-link">
          Back to the website
        </Link>
      </main>
    </div>
  );
}
