import type { Action, Amount } from "@/lib/timemachine";
import { fmtDate, usd } from "@/lib/format";

export function describeAmount(a: Amount, side: "buy" | "sell") {
  switch (a.kind) {
    case "dollars": return usd(a.value, 2);
    case "shares": return `${a.value.toLocaleString("en-US", { maximumFractionDigits: 4 })} shares`;
    case "percent": return side === "buy" ? `${a.value}% of cash` : `${a.value}% of position`;
    case "all": return side === "buy" ? "all available cash" : "entire position";
  }
}

export function describeAction(a: Action): { title: string; detail: string } {
  switch (a.type) {
    case "buy": return { title: `Buy ${a.ticker}`, detail: describeAmount(a.amount, "buy") };
    case "sell": return { title: `Sell ${a.ticker}`, detail: describeAmount(a.amount, "sell") };
    case "switch": return { title: `Switch ${a.ticker} → ${a.toTicker}`, detail: describeAmount(a.amount, "sell") };
    case "deposit": return { title: "Add cash", detail: usd(a.value, 2) };
    case "withdraw": return { title: "Withdraw cash", detail: usd(a.value, 2) };
    case "recurring":
      return {
        title: `Invest ${usd(a.value)} monthly in ${a.ticker}`,
        detail: a.endDate ? `until ${fmtDate(a.endDate)}` : "until the end date",
      };
  }
}

export const ACTION_LABEL: Record<Action["type"], string> = {
  buy: "Buy",
  sell: "Sell",
  switch: "Switch",
  deposit: "Add cash",
  withdraw: "Withdraw",
  recurring: "Monthly investing",
};
