import { NextResponse } from "next/server";

export const runtime = "nodejs";

const tickerDomains: Record<string, string> = {
  A: "agilent.com",
  AAPL: "apple.com",
  ABBV: "abbvie.com",
  ABNB: "airbnb.com",
  ADBE: "adobe.com",
  AMD: "amd.com",
  AMZN: "amazon.com",
  AVGO: "broadcom.com",
  CRM: "salesforce.com",
  DHR: "danaher.com",
  DIS: "disney.com",
  GOOGL: "google.com",
  GOOG: "google.com",
  HUBS: "hubspot.com",
  INTC: "intel.com",
  JPM: "jpmorganchase.com",
  MA: "mastercard.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  NFLX: "netflix.com",
  NVDA: "nvidia.com",
  ORCL: "oracle.com",
  PEP: "pepsico.com",
  QCOM: "qualcomm.com",
  SHOP: "shopify.com",
  SONY: "sony.com",
  SPOT: "spotify.com",
  TMO: "thermofisher.com",
  TSLA: "tesla.com",
  UBER: "uber.com",
  UNH: "unitedhealthgroup.com",
  V: "visa.com",
  VUSA: "vanguard.co.uk",
  WMT: "walmart.com",
  XYL: "xylem.com",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");
  if (!symbol) return svgResponse(monogramSvg("?"));

  const logoDevToken = process.env.NEXT_PUBLIC_LOGODEV_PUBLIC?.trim();
  if (logoDevToken) {
    const logo = await fetchImage(`https://img.logo.dev/ticker/${encodeURIComponent(symbol)}?token=${encodeURIComponent(logoDevToken)}&size=128&format=png`);
    if (logo) return imageResponse(logo);
  }

  const baseTicker = symbol.split(/[.\-]/)[0];
  const domain = tickerDomains[baseTicker];
  if (domain) {
    const favicon = await fetchImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    if (favicon) return imageResponse(favicon);
  }

  return svgResponse(monogramSvg(baseTicker.slice(0, 3)));
}

async function fetchImage(url: string) {
  try {
    const response = await fetch(url, { next: { revalidate: 604800 } });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return undefined;
    return { body: await response.arrayBuffer(), contentType };
  } catch {
    return undefined;
  }
}

function imageResponse(image: { body: ArrayBuffer; contentType: string }) {
  return new NextResponse(image.body, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
    },
  });
}

function svgResponse(svg: string) {
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
    },
  });
}

function monogramSvg(label: string) {
  const safeLabel = label.replace(/[^A-Z0-9?]/g, "").slice(0, 3) || "?";
  const hue = Array.from(safeLabel).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="22" fill="hsl(${hue} 34% 24%)"/><text x="64" y="72" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="800">${safeLabel}</text></svg>`;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 24);
}
