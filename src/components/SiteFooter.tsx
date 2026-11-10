"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/access") return null;

  return (
    <footer className="mt-24 bg-navy-deep text-slate">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-3 font-serif text-lg text-white/90">Your Future, Visualized.</p>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-slate/75">
            <strong className="font-semibold text-white">Educational prototype — not investment advice.</strong>{" "}
            WealthLab is a student demonstration project. Market prices are end-of-day, not real-time.
            Simulations ignore taxes, trading fees, and slippage. Nothing here is a recommendation to buy or
            sell any security. WealthLab is independent and not affiliated with any financial firm.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-copper">Explore</p>
            <ul className="space-y-2">
              <li><Link className="hover:text-white" href="/invest">Invest</Link></li>
              <li><Link className="hover:text-white" href="/time-machine">Time Machine</Link></li>
              <li><Link className="hover:text-white" href="/intelligence">Intelligence</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-copper">About</p>
            <ul className="space-y-2">
              <li><Link className="hover:text-white" href="/methodology">Methodology</Link></li>
              <li className="text-slate/60">Data: Tiingo (end-of-day), SEC EDGAR</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
