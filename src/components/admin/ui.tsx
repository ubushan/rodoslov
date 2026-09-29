/** Общие детали оформления панели администратора. */

export function Section({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-mist-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist-200 px-5 py-3.5">
        <div>
          <h2 className="font-display text-[17px] font-medium text-ink-800">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-ink-400">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-white px-4 py-3.5">
      <p className="text-[12px] uppercase tracking-[0.07em] text-ink-400">{label}</p>
      <p className="mt-1 font-display text-[26px] leading-none text-ink-800">{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-ink-400">{children}</p>
  );
}

/** Заглушка вместо данных, когда панель ещё не настроена. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const palette =
    tone === "warn"
      ? "border-[#e4c3bd] bg-[#fdf4f2] text-[#8c4438]"
      : "border-brass-500/40 bg-brass-500/10 text-ink-700";
  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-[13px] leading-relaxed ${palette}`}>
      <p className="font-medium">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "ok" | "warn" | "danger";
}) {
  const palette = {
    muted: "bg-mist-100 text-ink-500",
    ok: "bg-[#e8f2ea] text-[#3f6b4a]",
    warn: "bg-brass-500/15 text-[#8a6d13]",
    danger: "bg-[#fbeceb] text-[#a5463a]",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[12px] ${palette}`}>
      {children}
    </span>
  );
}
