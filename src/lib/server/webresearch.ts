import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_BETA, MODEL, aiError, anthropic, spendGuard } from "./ai";
import { DataError } from "./tiingo";

export interface WebSource { n: number; title: string; url: string; date: string | null }
export interface ResearchItem { text: string; cites: number[] }
export interface ResearchSection { heading: string; items: ResearchItem[] }
export interface WebResearch {
  sections: ResearchSection[];
  sources: WebSource[];
  removedUncited: number;
  generatedAt: string;
  model: string;
  searches: number;
}

type Block = Anthropic.Beta.BetaContentBlock;

/**
 * One AI call with Anthropic's server-side web search. Citations come back attached to text
 * blocks; we turn them into numbered sources (with the page's date when the search reports one)
 * and split the answer into "### Section" headings and "- item" bullets.
 */
export async function webResearch(opts: {
  system: string;
  prompt: string;
  maxSearches: number;
  requireCitations: (heading: string) => boolean;
}): Promise<WebResearch> {
  spendGuard();
  const client = anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const blocks: Block[] = [];
  try {
    for (let turn = 0; turn < 4; turn++) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 12000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium" },
        // The basic web search variant attaches citations directly to the answer text
        // (the dynamic-filtering variant can return final text without citation links).
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches }],
        messages,
      });
      if (res.stop_reason === "refusal") throw new DataError("The AI declined this research request.", "upstream", 502);
      blocks.push(...res.content);
      if (res.stop_reason !== "pause_turn") break;
      // Server tool paused a long turn: send it back to continue
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    }
  } catch (e) {
    throw aiError(e);
  }

  // Page dates from the search results
  const pageAge = new Map<string, string | null>();
  let searches = 0;
  for (const b of blocks) {
    if (b.type === "web_search_tool_result") {
      searches++;
      if (Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") pageAge.set(r.url, r.page_age ?? null);
    }
  }

  // Build text with citation markers ⟦n⟧
  const sources: WebSource[] = [];
  const byUrl = new Map<string, number>();
  let full = "";
  for (const b of blocks) {
    if (b.type !== "text") continue;
    full += b.text;
    const marks: number[] = [];
    for (const c of b.citations ?? []) {
      if (c.type !== "web_search_result_location") continue;
      let n = byUrl.get(c.url);
      if (!n) {
        n = sources.length + 1;
        byUrl.set(c.url, n);
        sources.push({ n, title: c.title ?? c.url, url: c.url, date: pageAge.get(c.url) ?? null });
      }
      if (!marks.includes(n)) marks.push(n);
    }
    if (marks.length) full += marks.map((n) => `⟦${n}⟧`).join("");
  }

  // Parse sections and items
  const sections: ResearchSection[] = [];
  let cur: ResearchSection | null = null;
  let removed = 0;
  const pushItem = (raw: string) => {
    if (!cur) return;
    const cites = [...raw.matchAll(/⟦(\d+)⟧/g)].map((m) => Number(m[1]));
    const text = raw.replace(/⟦\d+⟧/g, "").replace(/\*\*/g, "").replace(/^\s*[-•*]\s*/, "").trim();
    if (!text) return;
    if (opts.requireCitations(cur.heading) && cites.length === 0) { removed++; return; }
    cur.items.push({ text, cites: [...new Set(cites)] });
  };
  // A bullet may span several text blocks, so split on line starts
  for (const line of full.split(/\n(?=\s*(?:###|[-•*]\s))/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const h = trimmed.match(/^###\s*(.+?)(?:\n([\s\S]*))?$/);
    if (h) {
      cur = { heading: h[1].replace(/⟦\d+⟧/g, "").trim(), items: [] };
      sections.push(cur);
      if (h[2]?.trim()) pushItem(h[2]);
      continue;
    }
    pushItem(trimmed);
  }

  if (removed > 0 || sections.every((s) => s.items.length === 0)) {
    // Diagnostic for the server log (never shown to visitors)
    console.warn("[webResearch] blocks:", blocks.map((b) => (b.type === "text" ? `text(${b.citations?.length ?? 0} cites)` : b.type)).join(", "));
    console.warn("[webResearch] text sample:", full.slice(0, 1500));
  }

  // Renumber sources to only those still cited, in order of appearance
  const used = new Set(sections.flatMap((s) => s.items.flatMap((i) => i.cites)));
  const keep = sources.filter((s) => used.has(s.n));
  const remap = new Map(keep.map((s, k) => [s.n, k + 1]));
  for (const s of sections) for (const i of s.items) i.cites = i.cites.map((c) => remap.get(c)!).filter(Boolean);
  return {
    sections: sections.filter((s) => s.items.length > 0),
    sources: keep.map((s) => ({ ...s, n: remap.get(s.n)! })),
    removedUncited: removed,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    searches,
  };
}
