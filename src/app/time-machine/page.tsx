import type { Metadata } from "next";
import { Container, InProgress, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Time Machine" };

export default function TimeMachinePage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Time Machine"
        title="Go back. Decide. See what really happened."
        description="Replay real market history with actual end-of-day prices, make your own decisions, and compare every path against simply holding the S&P 500."
      />
      <Container className="py-12">
        <InProgress
          title="Time Machine"
          items={[
            "Buy, sell, deposit, withdraw, switch, and recurring contributions",
            "Daily cash, shares, cost basis, and portfolio value",
            "Correct handling of stock splits and dividends",
            "Alternate timelines compared on one chart",
            "Benchmark against holding SPY with the same cash flows",
            "Historical replays: March 2020 and the 1999–2002 tech bubble",
          ]}
        />
      </Container>
    </>
  );
}
