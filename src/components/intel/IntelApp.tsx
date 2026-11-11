"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui";
import { MarketsPanel } from "./MarketsPanel";
import { CompanyPanel } from "./CompanyPanel";
import { AssistantPanel } from "./AssistantPanel";
import { RiskPanel } from "./RiskPanel";
import { ScreenerPanel } from "./ScreenerPanel";
import { ThemesPanel } from "./ThemesPanel";

const TABS = [
  { id: "markets", label: "Markets & Pulse" },
  { id: "company", label: "Company research" },
  { id: "assistant", label: "AI research assistant" },
  { id: "themes", label: "Future Themes Lab" },
  { id: "risk", label: "Risk lab" },
  { id: "screener", label: "Screener" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function IntelApp() {
  const [tab, setTab] = useState<TabId>("markets");
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
          <nav aria-label="Intelligence tools" className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
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
          </nav>
        </Container>
      </div>
      <Container className="py-8 sm:py-10">
        {tab === "markets" && <MarketsPanel />}
        {tab === "company" && <CompanyPanel />}
        {tab === "assistant" && <AssistantPanel />}
        {tab === "themes" && <ThemesPanel />}
        {tab === "risk" && <RiskPanel />}
        {tab === "screener" && <ScreenerPanel />}
      </Container>
    </>
  );
}
