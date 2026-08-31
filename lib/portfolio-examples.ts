import type { ParsedPortfolio } from "@/lib/portfolio-import";

export const PELOSI_ANNUAL_DISCLOSURE_URL =
  "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/10075701.pdf";
export const PELOSI_Q1_PTR_URL =
  "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033725.pdf";
export const PELOSI_Q2_PTR_URL =
  "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034836.pdf";
export const PELOSI_ALLOCATION_SOURCE_URL = "https://x.com/InvestingVisual";
export const PELOSI_PORTRAIT_SOURCE_URL =
  "https://commons.wikimedia.org/wiki/File:Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg";
export const PELOSI_PORTRAIT_PATH = "/assets/nancy-pelosi-2019.jpg";

// Investing Visuals' Q2 2026 modeled allocation, reproduced as normalized
// weights rather than dollar values. Rounded components add to 100.1%.
export const PELOSI_Q2_2026_EXAMPLE: ParsedPortfolio = {
  source: "example",
  baseCurrency: "USD",
  asOf: "2026-06-30",
  cash: [{ currency: "USD", amount: 8.5 }],
  warnings: [],
  positions: [
    { symbol: "NVDA", name: "NVIDIA Corporation", quantity: 1, currency: "USD", reportedValue: 43.5 },
    { symbol: "AMZN", name: "Amazon.com, Inc.", quantity: 1, currency: "USD", reportedValue: 7.9 },
    { symbol: "AVGO", name: "Broadcom Inc.", quantity: 1, currency: "USD", reportedValue: 7.2 },
    { symbol: "MSFT", name: "Microsoft Corporation", quantity: 1, currency: "USD", reportedValue: 6.9 },
    { symbol: "GOOGL", name: "Alphabet Inc. Class A", quantity: 1, currency: "USD", reportedValue: 5.2 },
    { symbol: "OTHER", name: "Other modeled holdings", quantity: 1, currency: "USD", reportedValue: 20.9 },
  ],
};
