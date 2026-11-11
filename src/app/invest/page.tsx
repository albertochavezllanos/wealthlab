import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { InvestApp } from "@/components/invest/InvestApp";

export const metadata: Metadata = { title: "Invest" };

export default function InvestPage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Invest"
        title="See where today's choices could lead."
        description="Look up real investments with end-of-day prices, then project growth under assumptions you control. Projections are assumptions, not predictions."
      />
      <InvestApp />
    </>
  );
}
