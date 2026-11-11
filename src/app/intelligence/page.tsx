import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { IntelApp } from "@/components/intel/IntelApp";

export const metadata: Metadata = { title: "Intelligence" };

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Intelligence"
        title="Research that shows its sources."
        description="Real market numbers, company financials from SEC filings, risk measured from real history, and AI research that cites every fact and keeps evidence separate from interpretation."
      />
      <IntelApp />
    </>
  );
}
