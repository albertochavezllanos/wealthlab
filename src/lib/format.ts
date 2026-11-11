export const usd = (n: number, digits = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";

/** Price with sensible precision (crypto/penny prices get more decimals). */
export const price = (n: number) => usd(n, n < 1 ? 4 : 2);

export const compactUsd = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `$${(n / 1e3).toFixed(0)}K`;
  return usd(n);
};

export const pct = (n: number, digits = 1, signed = false) =>
  Number.isFinite(n) ? `${signed && n > 0 ? "+" : ""}${(n * 100).toFixed(digits)}%` : "—";

export const num = (n: number, digits = 2) =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "—";

/** "Nov 7, 2026" from YYYY-MM-DD, without timezone drift. */
export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
