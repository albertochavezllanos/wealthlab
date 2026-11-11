import "server-only";
import { memo } from "./memo";
import { webResearch, type WebResearch } from "./webresearch";
import { THEMES } from "@/lib/themes";
import { DataError } from "./tiingo";

// ---------------- Market Pulse ----------------

const PULSE_SYSTEM = `You write WealthLab's "Market Pulse": a short, factual briefing on what is moving world financial markets right now, for an educational prototype.

Use the web search tool to find recent, reputable reporting (major wire services, financial newspapers, central banks, government statistics agencies). Then write 5 to 6 items.

Format exactly:
### <short headline>
<two or three plain-English sentences: what happened, when (include the date), and why markets care>

Rules:
- Every sentence must be supported by the search results you cite. Do not state anything you did not find in a source.
- Include the date of each development in the text.
- Cover a mix: U.S. markets, interest rates/central banks, inflation or jobs data, major non-U.S. markets, and commodities or currencies where relevant.
- No predictions, no price targets, no buy/sell language. Describe, don't advise.
- No introduction or conclusion outside the items.`;

async function pulseCached(): Promise<WebResearch> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const r = await webResearch({
    system: PULSE_SYSTEM,
    prompt: `Today is ${today} (U.S. Central Time). Write today's Market Pulse briefing covering the last few days.`,
    maxSearches: 6,
    requireCitations: () => true,
  });
  if (r.sections.length === 0) throw new DataError("The briefing came back without cited sources, so it wasn't shown. Please try again later.", "upstream", 502);
  return r;
}

export function getPulse() {
  return memo("pulse", 3 * 3600 * 1000, pulseCached);
}

// ---------------- Future Themes ----------------

const THEME_SYSTEM = `You research long-term investment themes for WealthLab, an educational prototype. Use the web search tool to find authoritative evidence (international organizations, government agencies, peer-reviewed or major industry research, company filings).

Format exactly:
### Evidence
- <one factual data point with its year and who reported it>
(4 to 5 bullets)
### What has to go right
- <condition that must hold for the theme to play out>
(3 bullets)
### What could go wrong
- <risk that could weaken the theme or hurt investors even if the theme is real, e.g. high valuations, competition, regulation, technology shifts>
(3 to 4 bullets)

Rules:
- Every Evidence bullet must be supported by a cited search result. Do not add numbers from memory.
- Cite sources for the other bullets whenever they rely on facts.
- Horizon: the next 15 to 20 years. No predictions of prices or returns, no recommendations, no buy/sell language.
- No text outside the three sections.`;

async function themeCached(id: string): Promise<WebResearch> {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new DataError("Unknown theme.", "not_found", 404);
  const r = await webResearch({
    system: THEME_SYSTEM,
    prompt: `Theme: ${theme.title}. ${theme.oneLiner}\nResearch focus: ${theme.researchFocus}.`,
    maxSearches: 5,
    requireCitations: (h) => /evidence/i.test(h),
  });
  if (!r.sections.some((s) => /evidence/i.test(s.heading) && s.items.length)) {
    throw new DataError("The research came back without cited evidence, so it wasn't shown. Please try again later.", "upstream", 502);
  }
  return r;
}

export function getThemeResearch(id: string) {
  return memo(`theme:${id}`, 24 * 3600 * 1000, () => themeCached(id));
}
