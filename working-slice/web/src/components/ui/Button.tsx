import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-linear-to-r from-iris to-orchid text-white shadow-md shadow-iris/25 hover:brightness-110",
  secondary: "bg-frost text-night ring-1 ring-rule-strong hover:bg-haze",
  quiet: "text-night-soft hover:bg-mist hover:text-night",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  const sizing = size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-4 text-[14px]";
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[background-color,filter,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
