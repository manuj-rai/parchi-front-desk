"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** A page that moved. A static site cannot answer with a redirect, so the browser is sent on. */
export function RedirectTo({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return (
    <p className="grid min-h-dvh place-items-center bg-lilac text-[14px] text-night-soft">
      <Link href={href} data-testid="redirect-link" className="font-semibold text-iris-deep underline underline-offset-4">{label}</Link>
    </p>
  );
}
