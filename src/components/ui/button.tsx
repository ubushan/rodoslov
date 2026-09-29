import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-brass-500 text-ink-900 hover:bg-brass-400 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]",
  secondary:
    "bg-surface text-ink-800 border border-mist-300 hover:border-ink-300 hover:bg-mist-50",
  ghost: "text-ink-600 hover:bg-mist-200",
  danger: "bg-surface text-danger border border-danger-line hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-sm rounded-[10px]",
  lg: "h-12 px-6 text-[15px] rounded-xl",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ variant = "primary", size = "md", className = "", ...props }, ref) => (
  <button
    ref={ref}
    className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  />
));
Button.displayName = "Button";
