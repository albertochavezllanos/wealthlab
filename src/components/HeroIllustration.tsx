/**
 * Hero chart. Not market data: it is a pure compound-interest calculation
 * ($500/month for 30 years at an assumed 6% annual return), labelled as such.
 */
function series() {
  const monthly = 500;
  const r = 0.06 / 12;
  const pts: { year: number; contributed: number; value: number }[] = [];
  let value = 0;
  for (let m = 1; m <= 360; m++) {
    value = value * (1 + r) + monthly;
    if (m % 12 === 0) pts.push({ year: m / 12, contributed: monthly * m, value });
  }
  return pts;
}

export function HeroIllustration() {
  const data = series();
  const W = 520;
  const H = 300;
  const pad = { l: 12, r: 12, t: 20, b: 28 };
  const max = data[data.length - 1].value;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);

  const area = (key: "contributed" | "value") =>
    `M ${x(0)} ${H - pad.b} ` +
    data.map((d, i) => `L ${x(i)} ${y(d[key])}`).join(" ") +
    ` L ${x(data.length - 1)} ${H - pad.b} Z`;
  const line = (key: "contributed" | "value") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");

  const final = data[data.length - 1];
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <figure className="rounded-2xl border border-slate-line/70 bg-white p-5 shadow-lift sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Illustration</p>
          <p className="mt-1 font-serif text-lg text-navy">$500 a month for 30 years</p>
        </div>
        <div className="text-right">
          <p className="num font-serif text-2xl text-navy">{fmt(final.value)}</p>
          <p className="num text-xs text-muted">{fmt(final.contributed)} contributed</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Illustrative chart of contributions versus growth over 30 years">
        <defs>
          <linearGradient id="g-growth" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C77B39" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#C77B39" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="g-principal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#24639A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#24639A" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#E8EEF3" />
        ))}
        <path d={area("value")} fill="url(#g-growth)" />
        <path d={line("value")} fill="none" stroke="#C77B39" strokeWidth="2.4" />
        <path d={area("contributed")} fill="url(#g-principal)" />
        <path d={line("contributed")} fill="none" stroke="#123A63" strokeWidth="2" />
        {[0, 9, 19, 29].map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="#5B6878" textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"}>
            Year {data[i].year}
          </text>
        ))}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-navy" />Money you put in</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-copper" />Growth</span>
        <span>Assumes a steady 6% annual return. An assumption, not a prediction.</span>
      </figcaption>
    </figure>
  );
}
