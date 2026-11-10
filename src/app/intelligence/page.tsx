import type { Metadata } from "next";
import { Container, InProgress, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Intelligence" };

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Intelligence"
        title="Research that shows its sources."
        description="Real market numbers, company financials from SEC filings, and an AI research assistant that cites every fact and separates evidence from interpretation."
      />
      <Container className="py-12">
        <InProgress
          title="Intelligence"
          items={[
            "Market overview: major indexes and sectors",
            "Market Pulse: a cited world-markets briefing",
            "Company research from SEC filings",
            "AI research assistant with citations",
            "Future Themes Lab: long-term research shortlists",
            "Risk metrics and a curated screener",
          ]}
        />
      </Container>
    </>
  );
}
