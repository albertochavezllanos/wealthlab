import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { HeroIllustration } from "@/components/HeroIllustration";

const SYSTEMS = [
  {
    href: "/invest",
    name: "WealthLab Invest",
    tag: "Plan forward",
    body: "Search real investments, project future growth under your own assumptions, see the cost of waiting, and build portfolios side by side.",
    points: ["Growth simulator", "Cost of waiting", "Portfolio builder"],
  },
  {
    href: "/time-machine",
    name: "WealthLab Time Machine",
    tag: "Replay history",
    body: "Go back in time with real end-of-day prices. Make decisions, branch alternate timelines, and compare every path against simply holding the S&P 500.",
    points: ["Real transactions", "Alternate timelines", "Historical replays"],
  },
  {
    href: "/intelligence",
    name: "WealthLab Intelligence",
    tag: "Research with sources",
    body: "Market overview, company financials from SEC filings, risk metrics from real history, and an AI research assistant that cites every fact.",
    points: ["Market Pulse", "Company research", "Future Themes Lab"],
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate/80 via-ivory to-ivory" />
        <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow>Your Future, Visualized</Eyebrow>
            <h1 className="mt-4 font-serif text-[2.4rem] font-medium leading-[1.08] tracking-tight text-navy sm:text-6xl">
              Make today&rsquo;s decisions with tomorrow in mind.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Explore how different financial choices could shape your future.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/invest"
                className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-blue"
              >
                Start planning
              </Link>
              <Link
                href="/time-machine"
                className="rounded-full border border-navy/20 bg-white px-6 py-3 text-sm font-semibold text-navy transition hover:border-navy/40"
              >
                Open the Time Machine
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted">
              Educational prototype — not investment advice. End-of-day market data.
            </p>
          </div>
          <HeroIllustration />
        </Container>
      </section>

      <Container className="py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {SYSTEMS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-slate-line/70 bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <span className="num font-serif text-sm text-copper">0{i + 1}</span>
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{s.tag}</span>
              </div>
              <h2 className="mt-6 font-serif text-2xl text-navy">{s.name}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{s.body}</p>
              <ul className="mt-6 space-y-1.5 border-t border-slate pt-4 text-sm text-charcoal">
                {s.points.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-copper" />
                    {p}
                  </li>
                ))}
              </ul>
              <span className="mt-6 text-sm font-semibold text-blue group-hover:text-navy">Explore →</span>
            </Link>
          ))}
        </div>
      </Container>

      <Container className="py-16">
        <div className="grid gap-8 rounded-2xl bg-navy px-8 py-10 text-white md:grid-cols-3">
          {[
            ["Real data, labelled honestly", "End-of-day prices from Tiingo and financials from SEC EDGAR, each with its date and source."],
            ["Assumptions, not predictions", "Every projection shows the assumptions behind it. No one knows future returns."],
            ["Accounting you can check", "Cash plus holdings equals portfolio value after every transaction. Splits and dividends handled explicitly."],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="font-serif text-lg">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{b}</p>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
