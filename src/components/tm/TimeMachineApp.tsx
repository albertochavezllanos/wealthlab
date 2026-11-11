"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui";
import { Builder } from "./Builder";
import { ReplayCovid } from "./ReplayCovid";
import { ReplayBubble } from "./ReplayBubble";

const TABS = [
  { id: "build", label: "Build & compare timelines" },
  { id: "covid", label: "Replay: March 2020" },
  { id: "bubble", label: "Replay: Tech bubble" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function TimeMachineApp() {
  const [tab, setTab] = useState<TabId>("build");
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  return (
    <>
      <div className="border-b border-slate-line/70 bg-ivory">
        <Container>
          <nav aria-label="Time Machine tools" className="flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); history.replaceState(null, "", `#${t.id}`); }}
                aria-current={tab === t.id ? "page" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${tab === t.id ? "bg-white text-navy shadow-card ring-1 ring-slate-line" : "text-muted hover:text-charcoal"}`}
              >
                {t.label}
              </button>
            ))}
            <Link href="/methodology" className="ml-auto shrink-0 rounded-full px-4 py-2 text-sm font-medium text-blue hover:text-navy">How it&rsquo;s calculated →</Link>
          </nav>
        </Container>
      </div>
      <Container className="py-8 sm:py-10">
        {tab === "build" && <Builder />}
        {tab === "covid" && <ReplayCovid />}
        {tab === "bubble" && <ReplayBubble />}
      </Container>
    </>
  );
}
