import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { TimeMachineApp } from "@/components/tm/TimeMachineApp";

export const metadata: Metadata = { title: "Time Machine" };

export default function TimeMachinePage() {
  return (
    <>
      <PageHeader
        eyebrow="WealthLab Time Machine"
        title="Go back. Decide. See what really happened."
        description="Replay real market history with actual end-of-day prices. Make decisions, branch alternate timelines, and compare every path against simply holding the S&P 500 with the same cash flows."
      />
      <TimeMachineApp />
    </>
  );
}
