/** WealthLab wordmark: an original rising-bars mark plus serif wordmark. */
export function Logo({ light = false }: { light?: boolean }) {
  const text = light ? "text-white" : "text-navy";
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill={light ? "#ffffff" : "#123A63"} />
        <rect x="7" y="15" width="3.2" height="6" rx="1" fill={light ? "#123A63" : "#E8EEF3"} />
        <rect x="12.4" y="11" width="3.2" height="10" rx="1" fill={light ? "#24639A" : "#9FBCD6"} />
        <rect x="17.8" y="7" width="3.2" height="14" rx="1" fill="#C77B39" />
      </svg>
      <span className={`font-serif text-[1.3rem] font-semibold tracking-tight ${text}`}>
        Wealth<span className="text-copper">Lab</span>
      </span>
    </span>
  );
}
