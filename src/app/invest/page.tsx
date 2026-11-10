import type { Metadata } from "next";
import { Container, InProgress, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Invest" };

export default function InvestPage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Invest"
        title="See where today's choices could lead."
        description="Look up real investments, then project growth under assumptions you control. Every projection is an assumption, not a prediction."
      />
      <Container className="py-12">
        <InProgress
          title="Invest tools"
          items={[
            "Search stocks, ETFs, funds, and crypto with end-of-day prices",
            "Future growth simulator with a year-by-year table",
            "Inflation-adjusted view in today's dollars",
            "Cost of Waiting comparison",
            "Portfolio builder with allocation weights",
            "Side-by-side strategy comparisons and saved scenarios",
          ]}
        />
      </Container>
    </>
  );
}
