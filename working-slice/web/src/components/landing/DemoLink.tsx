import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "gradient" | "light";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  gradient: "bg-linear-to-r from-iris to-orchid text-white shadow-lg shadow-iris/30 hover:brightness-110",
  light: "bg-frost text-night shadow-lg shadow-night/20 hover:bg-iris-wash",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

interface DemoLinkProps {
  testId: string;
  href?: string;          // the demo by default; the app for "Open the app"
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

/** The one action on the intro page: open the live console. */
export function DemoLink({ testId, href = "/demo/", variant = "gradient", size = "md", children = "Try the live demo" }: DemoLinkProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold transition-[filter,background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${SIZES[size]} ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}
