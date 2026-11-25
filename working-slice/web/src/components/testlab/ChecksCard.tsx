"use client";

import { useState } from "react";
import { Icon } from "@/components/app/Icon";
import { Button } from "@/components/ui/Button";
import { staffApi } from "@/lib/api";
import type { SelfTestReport } from "@/lib/types";
import { CheckRow } from "./CheckRow";
import { PassRing } from "./PassRing";

interface ChecksCardProps {
  testMode: boolean;                      // offline: free; live: real model calls, a few cents
  onFailure: (failure: unknown) => void;
}

function seconds(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** "Run all checks": the brief's calls through the real call flow, each passed or failed. */
export function ChecksCard({ testMode, onFailure }: ChecksCardProps) {
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = async () => {
    setConfirming(false);
    setRunning(true);
    try {
      setReport(await staffApi.selfTest());
    } catch (failure) {
      onFailure(failure);
    } finally {
      setRunning(false);
    }
  };

  const allPassed = report && report.passed === report.total;
  const totalMs = report?.results.reduce((sum, result) => sum + result.ms, 0) ?? 0;
  const slowest = Math.max(1, ...(report?.results.map((result) => result.ms) ?? []));
  return (
    <section aria-labelledby="checks-title" className="rounded-[24px] bg-frost p-5 shadow-lg shadow-night/5 ring-1 ring-iris-wash" data-testid="testlab-checks">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="checks-title" className="text-[18px] font-bold tracking-[-0.02em] text-night">Automatic checks</h2>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-night-soft">
            Plays the brief&apos;s calls through the real call flow, on a fresh board for the general physician&apos;s clinic,
            and checks what Parchi did after each line. Nothing real is touched.{" "}
            {testMode
              ? "In offline test mode the stand-in models answer: free, and the same every time."
              : "With live models these are real model calls: they cost a few cents, and answers can vary between runs."}
          </p>
        </div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="testlab-confirm">
            <span className="text-[13px] font-medium text-haldi">Live models: a few cents.</span>
            <Button size="sm" variant="primary" onClick={() => void run()} data-testid="testlab-confirm-run">Run them</Button>
            <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="primary" disabled={running} onClick={() => (testMode ? void run() : setConfirming(true))} data-testid="testlab-run-checks">
            <Icon name="play" className="size-4" />
            {running ? "Running…" : report ? "Run again" : "Run all checks"}
          </Button>
        )}
      </div>

      {running && (
        <div className="mt-4" aria-live="polite" data-testid="testlab-running">
          <p className="sr-only">Running the checks…</p>
          <ul aria-hidden className="grid gap-2 lg:grid-cols-2">
            {Array.from({ length: report?.total ?? 6 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 rounded-2xl bg-haze px-3.5 py-3 ring-1 ring-rule">
                <span className="size-6 animate-pulse rounded-full bg-mist" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-3 w-2/5 animate-pulse rounded-full bg-mist" />
                  <span className="block h-2.5 w-3/4 animate-pulse rounded-full bg-mist" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report && !running && (
        <div className="mt-4" aria-live="polite">
          <div className={`flex flex-wrap items-center gap-4 rounded-[20px] px-4 py-3.5 ${allPassed ? "bg-wall-wash" : "bg-stamp-wash"}`}>
            <PassRing passed={report.passed} total={report.total} />
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-2 text-[15px] font-bold ${allPassed ? "text-wall" : "text-stamp"}`} data-testid="testlab-checks-summary">
                <Icon name={allPassed ? "check" : "cross"} className="size-4" />
                {report.passed} of {report.total} checks passed
              </p>
              <p className="mt-0.5 text-[12.5px] text-night-soft">
                {report.clinic} · {report.mode === "live" ? "live models" : "stand-in models"} · {seconds(totalMs)} in all
              </p>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {report.results.map((result) => <CheckRow key={result.id} result={result} slowest={slowest} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
