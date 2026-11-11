"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui";
import { ResearchPanel } from "./ResearchPanel";
import { SimulatorPanel } from "./SimulatorPanel";
import { WaitingPanel } from "./WaitingPanel";
import { StrategiesPanel } from "./StrategiesPanel";
import { PortfolioPanel } from "./PortfolioPanel";

const TABS = [
  { id: "research", label: "Look up investments" },
  { id: "simulator", label: "Growth simulator" },
  { id: "waiting", label: "Cost of waiting" },
  { id: "compare", label: "Compare strategies" },
  { id: "portfolio", label: "Portfolio builder" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function InvestApp() {
  const [tab, setTab] = useState<TabId>("research");

  // Deep-link support: /invest#simulator
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function select(id: TabId) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <>
      <div className="border-b border-slate-line/70 bg-ivory">
        <Container>
          <nav aria-label="Invest tools" className="-mb-px flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => select(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t.id ? "bg-white text-navy shadow-card ring-1 ring-slate-line" : "text-muted hover:text-charcoal"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </Container>
      </div>
      <Container className="py-8 sm:py-10">
        {tab === "research" && <ResearchPanel />}
        {tab === "simulator" && <SimulatorPanel />}
        {tab === "waiting" && <WaitingPanel />}
        {tab === "compare" && <StrategiesPanel />}
        {tab === "portfolio" && <PortfolioPanel />}
      </Container>
    </>
  );
}
