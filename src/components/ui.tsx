import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">{children}</p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-slate-line/70 bg-gradient-to-b from-slate/70 to-ivory">
      <Container className="py-12 sm:py-16">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl font-medium leading-tight text-navy sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{description}</p>
        )}
        {children}
      </Container>
    </section>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`rounded-2xl border border-slate-line/70 bg-white p-6 shadow-card ${className}`}>
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "copper" | "navy" | "positive" | "negative";
}) {
  const tones = {
    slate: "bg-slate text-charcoal",
    copper: "bg-copper-soft text-[#8a4f1d]",
    navy: "bg-navy text-white",
    positive: "bg-positive/10 text-positive",
    negative: "bg-negative/10 text-negative",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Honest "not built yet" notice used while a stage is in progress. No fake controls. */
export function InProgress({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="border-dashed">
      <div className="flex items-center gap-2">
        <Badge tone="copper">In development</Badge>
        <h2 className="font-serif text-xl text-navy">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-muted">This section is being built. It will include:</p>
      <ul className="mt-3 grid gap-2 text-sm text-charcoal sm:grid-cols-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper" />
            {i}
          </li>
        ))}
      </ul>
    </Card>
  );
}
