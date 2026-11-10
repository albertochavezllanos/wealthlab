# WealthLab — Progress Log

Deadline: **7:00 a.m. Central, Nov 11, 2026.** Started 3:13 p.m. Central, Nov 10.

Full build brief: see the original instructions (stack, rules, three systems, design colors). Key rules:
never fabricate data; no fake buttons; keys only in `.env.local` and Vercel; end-of-day labelling;
"Educational prototype — not investment advice" everywhere; no Baird branding or implied affiliation.

## Project facts
- Next.js 16.4 (App Router, `cacheComponents` on, `src/` dir), React 19.3, Tailwind 4, Recharts, TypeScript.
- Next 16 renames middleware to **`src/proxy.ts`** (passcode gate lives there).
- Design tokens in `src/app/globals.css` (`navy`, `blue`, `copper`, `ivory`, `charcoal`, `slate`, ...).
  Fonts: Inter (body) + Source Serif 4 (headings, `font-serif`).
- Env vars: `DEMO_PASSCODE`, `TIINGO_API_KEY`, `ANTHROPIC_API_KEY`, `SEC_CONTACT_EMAIL`.

## Stage status
- [x] **Stage 1 — Foundation**: layout, header (with disclaimer strip) + mobile menu, footer, home page,
  passcode screen (`/access`, `/api/access`, `src/proxy.ts`), placeholder pages for Invest / Time Machine /
  Intelligence / Methodology (honest "in development" cards, no fake controls).
- [ ] Stage 2 — Invest
- [ ] Stage 3 — Time Machine
- [ ] Stage 4 — Intelligence core
- [ ] Stage 5 — Market Pulse + Future Themes Lab
- [ ] Stage 6 — Testing and final deploy
- [ ] Stage 7 — Deliverables (feature list, demo script, role statement)

## Deployment
- GitHub: (pending)
- Vercel: (pending)

## Notes for the next session
- (none yet)
