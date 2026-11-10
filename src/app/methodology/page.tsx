import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Methodology" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Price data",
    body: [
      "Prices come from Tiingo's end-of-day data. They are the official closing prices for each trading day, not real-time quotes. Every price shown includes the date it refers to.",
      "Tiingo's free data is licensed for personal use, which is why this prototype is behind a passcode.",
    ],
  },
  {
    title: "What simulations ignore",
    body: [
      "All simulations ignore taxes, trading fees and commissions, bid-ask spreads, and slippage. Real-world results would be lower.",
      "Projected returns in the Invest tools are assumptions you choose. They are not predictions.",
    ],
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Methodology"
        title="How WealthLab calculates what you see."
        description="A plain-English explanation of the data and the accounting rules behind every number. The full methodology, covering splits, dividends, transaction timing, and data gaps, is added alongside the Time Machine."
      />
      <Container className="grid gap-6 py-12 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} as="section">
            <h2 className="font-serif text-xl text-navy">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 text-sm leading-relaxed text-charcoal">
                {p}
              </p>
            ))}
          </Card>
        ))}
      </Container>
    </>
  );
}
