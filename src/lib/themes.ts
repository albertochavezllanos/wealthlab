/** Future Themes Lab: long-term research themes and the investments with exposure to each. Client-safe. */
import type { Known } from "./universe";

export interface Theme {
  id: string;
  title: string;
  oneLiner: string;
  /** What the AI researches (with web search) for cited evidence */
  researchFocus: string;
  exposures: (Known & { why: string })[];
}

const st = (ticker: string, name: string, why: string) => ({ ticker, name, assetType: "Stock" as const, why });
const et = (ticker: string, name: string, why: string) => ({ ticker, name, assetType: "ETF" as const, why });

export const THEMES: Theme[] = [
  {
    id: "aging",
    title: "Aging populations",
    oneLiner: "More people living longer, especially in developed economies and China, raising demand for healthcare and retirement services.",
    researchFocus: "demographic projections for people aged 65+ (UN, U.S. Census, OECD) and the resulting healthcare and retirement spending trends",
    exposures: [
      et("XLV", "Health Care Select Sector SPDR", "Broad basket of U.S. healthcare companies"),
      st("UNH", "UnitedHealth Group", "Largest U.S. health insurer, including Medicare plans"),
      st("ISRG", "Intuitive Surgical", "Surgical robotics used in procedures common in older patients"),
      st("JNJ", "Johnson & Johnson", "Medical devices and pharmaceuticals"),
    ],
  },
  {
    id: "ai",
    title: "AI & computing demand",
    oneLiner: "Rapid growth in data-center spending to train and run AI models, driving demand for chips, cloud, and software.",
    researchFocus: "data-center and AI infrastructure capital spending, semiconductor demand forecasts, and adoption data from credible sources (IEA, company filings, industry research)",
    exposures: [
      et("SMH", "VanEck Semiconductor ETF", "Basket of the largest chip designers and manufacturers"),
      st("NVDA", "NVIDIA", "Leading supplier of AI accelerator chips"),
      st("MSFT", "Microsoft", "Cloud computing (Azure) and AI software"),
      st("AVGO", "Broadcom", "Custom AI chips and networking"),
    ],
  },
  {
    id: "energy",
    title: "Energy infrastructure & electrification",
    oneLiner: "Rising electricity demand from data centers, EVs, and electrified industry requires grid, generation, and storage investment.",
    researchFocus: "electricity demand growth projections, grid investment needs, and renewable and storage build-out (IEA, U.S. EIA, DOE)",
    exposures: [
      et("XLU", "Utilities Select Sector SPDR", "Regulated U.S. electric and gas utilities"),
      st("NEE", "NextEra Energy", "Large utility and renewable energy developer"),
      st("ETN", "Eaton", "Electrical equipment for grids and data centers"),
      et("ICLN", "iShares Global Clean Energy ETF", "Global solar, wind, and clean-power companies"),
    ],
  },
  {
    id: "water",
    title: "Water scarcity & infrastructure",
    oneLiner: "Aging pipes, growing demand, and droughts push investment in water treatment, delivery, and efficiency.",
    researchFocus: "water infrastructure investment needs (EPA, ASCE report card), global water stress data (UN, WRI), and utility spending trends",
    exposures: [
      et("PHO", "Invesco Water Resources ETF", "Companies in water treatment, delivery, and equipment"),
      st("AWK", "American Water Works", "Largest U.S. publicly traded water utility"),
      st("XYL", "Xylem", "Water pumps, meters, and treatment technology"),
    ],
  },
  {
    id: "health-innovation",
    title: "Healthcare innovation",
    oneLiner: "New drug classes (such as GLP-1 treatments), gene therapies, and medical technology are reshaping treatment of chronic disease.",
    researchFocus: "prevalence of obesity and chronic disease, adoption and forecasts for GLP-1 medicines, and biotech R&D trends (WHO, CDC, company filings)",
    exposures: [
      st("LLY", "Eli Lilly", "Major maker of GLP-1 diabetes and obesity drugs"),
      et("XBI", "SPDR S&P Biotech ETF", "Equal-weighted basket of U.S. biotech companies"),
      st("MRK", "Merck", "Large pharmaceutical company with oncology focus"),
    ],
  },
  {
    id: "cyber",
    title: "Cybersecurity",
    oneLiner: "As more of the economy runs online, the cost of breaches rises and security spending grows.",
    researchFocus: "cost of cybercrime and data breaches, and security spending forecasts (IBM Cost of a Data Breach, FBI IC3, Gartner)",
    exposures: [
      et("CIBR", "First Trust NASDAQ Cybersecurity ETF", "Basket of cybersecurity companies"),
      st("PANW", "Palo Alto Networks", "Network and cloud security"),
      st("CRWD", "CrowdStrike", "Endpoint and cloud security"),
    ],
  },
];

export const THEME_KNOWN: Known[] = THEMES.flatMap((t) => t.exposures.map(({ ticker, name, assetType }) => ({ ticker, name, assetType })));
