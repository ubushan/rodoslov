import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";

/* Кнопки студии: радиус 10–12px, у главной — заливка акцентом с тёмным текстом */
const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(180deg,var(--p-fill),var(--p-fill-2))] text-on-fill font-semibold " +
    "border border-[var(--p-fill-2)] shadow-[var(--p-inset-hi)] hover:brightness-[1.06] " +
    "active:translate-y-px",
  secondary:
    "bg-surface text-ink-700 border border-[var(--p-line)] shadow-[var(--p-inset-hi)] " +
    "hover:border-[var(--p-line-3)] hover:bg-[var(--p-hover-bg)] active:bg-[var(--p-press-bg)]",
  ghost: "text-ink-600 hover:bg-[var(--p-hover-bg)] hover:text-ink-800 active:bg-[var(--p-press-bg)]",
  danger: "bg-surface text-danger border border-danger-line hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[10px]",
  md: "h-10 px-4 text-sm rounded-[11px]",
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
