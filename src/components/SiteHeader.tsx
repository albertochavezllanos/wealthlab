"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

export const NAV = [
  { href: "/invest", label: "Invest" },
  { href: "/time-machine", label: "Time Machine" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the page changes
  useEffect(() => setOpen(false), [pathname]);

  if (pathname === "/access") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-line/70 bg-ivory/90 backdrop-blur">
      <div className="bg-navy text-center text-[11px] font-medium tracking-wide text-white/85 sm:text-xs">
        <p className="mx-auto max-w-6xl px-4 py-1.5">
          <span className="text-copper">●</span> Educational prototype — not investment advice · Prices are end-of-day, not real-time
        </p>
      </div>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="WealthLab home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-navy text-white" : "text-charcoal hover:bg-slate"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-slate md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-line bg-ivory px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-3 text-base font-medium ${
                  active ? "bg-slate text-navy" : "text-charcoal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
