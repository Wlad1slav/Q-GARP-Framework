import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { runCachedYahooRequest } from "@/lib/yahoo-request-queue";
import type { ImportedPortfolioCash, ImportedPortfolioPosition } from "@/lib/portfolio-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteRequest = {
  positions?: ImportedPortfolioPosition[];
  cash?: ImportedPortfolioCash[];
  baseCurrency?: string;
  source?: "yahoo" | "revolut" | "ibkr";
};

type YahooQuote = {
  symbol?: string;
  regularMarketPrice?: number;
  currency?: string;
  shortName?: string;
  longName?: string;
};

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export async function POST(request: Request) {
  let payload: QuoteRequest;

  try {
    payload = (await request.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const positions = sanitizePositions(payload.positions ?? []).slice(0, 60);
  const cash = sanitizeCash(payload.cash ?? []).slice(0, 12);
  const baseCurrency = normalizeCurrency(payload.baseCurrency) || "USD";
  if (!positions.length) {
    return NextResponse.json({ message: "No portfolio positions supplied." }, { status: 400 });
  }

  const candidateMap = new Map<string, string[]>();
  for (const position of positions) {
    candidateMap.set(position.symbol, quoteCandidates(position.symbol, position.currency, payload.source));
  }
  const candidates = Array.from(new Set(Array.from(candidateMap.values()).flat())).slice(0, 120);
  const quotes = await loadQuotes(candidates);
  const quoteBySymbol = new Map(
    quotes
      .filter((quote) => quote.symbol)
      .map((quote) => [normalizeSymbol(quote.symbol), quote]),
  );
  const selectedQuotes = positions.map((position) => selectQuote(position, candidateMap.get(position.symbol) ?? [], quoteBySymbol));
  const currencies = Array.from(new Set([
    ...selectedQuotes.map((quote, index) => normalizeCurrency(quote?.currency) || positions[index].currency || baseCurrency),
    ...cash.map((item) => item.currency),
  ])).filter((currency) => currency && currency !== baseCurrency);
  const fxRates = await loadFxRates(currencies, baseCurrency);

  const resolvedPositions = positions.map((position, index) => {
    const quote = selectedQuotes[index];
    const price = finitePositive(quote?.regularMarketPrice) ? quote.regularMarketPrice : position.fallbackPrice;
    const currency = normalizeCurrency(quote?.currency) || position.currency || baseCurrency;
    const fxToBase = currency === baseCurrency ? 1 : fxRates[currency] ?? position.fxToBase ?? 1;
    const reportedValue = Number.isFinite(position.reportedValue) ? (position.reportedValue as number) * fxToBase : undefined;
    const marketValue = finitePositive(price) ? position.quantity * price * fxToBase : undefined;

    return {
      sourceSymbol: position.symbol,
      quoteSymbol: quote?.symbol ?? position.symbol,
      name: quote?.longName || quote?.shortName || position.name || position.symbol,
      quantity: position.quantity,
      price,
      currency,
      fxToBase,
      valueBase: reportedValue ?? marketValue ?? 0,
      live: Boolean(quote && finitePositive(quote.regularMarketPrice)),
    };
  });

  const cashValueBase = cash.reduce((sum, item) => {
    const fxToBase = item.currency === baseCurrency ? 1 : fxRates[item.currency] ?? item.fxToBase ?? 1;
    return sum + item.amount * fxToBase;
  }, 0);

  return NextResponse.json(
    {
      baseCurrency,
      positions: resolvedPositions,
      cashValueBase,
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    },
  );
}

async function loadQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (!symbols.length) return [];

  try {
    return (await runCachedYahooRequest(`portfolio-quotes:${symbols.join(",")}`, "single", () =>
      yahooFinance.quote(symbols, { return: "array" }, { validateResult: false }),
    )) as YahooQuote[];
  } catch {
    return [];
  }
}

async function loadFxRates(currencies: string[], baseCurrency: string) {
  const pairs = currencies.map((currency) => `${currency}${baseCurrency}=X`);
  const quotes = await loadQuotes(pairs);
  const rates: Record<string, number> = {};

  for (const quote of quotes) {
    const shortName = quote.shortName?.toUpperCase() ?? "";
    const fromCurrency = currencies.find((currency) => shortName === `${currency}/${baseCurrency}`);
    if (fromCurrency && finitePositive(quote.regularMarketPrice)) {
      rates[fromCurrency] = quote.regularMarketPrice;
    }
  }

  return rates;
}

function selectQuote(
  position: ImportedPortfolioPosition,
  candidates: string[],
  quoteBySymbol: Map<string, YahooQuote>,
) {
  const available = candidates
    .map((candidate) => quoteBySymbol.get(normalizeSymbol(candidate)))
    .filter((quote): quote is YahooQuote => Boolean(quote && finitePositive(quote.regularMarketPrice)));
  const currency = normalizeCurrency(position.currency);

  return available.find((quote) => currency && normalizeCurrency(quote.currency) === currency) ?? available[0];
}

function quoteCandidates(symbol: string, currency = "", source?: QuoteRequest["source"]) {
  const clean = normalizeSymbol(symbol);
  if (!clean || clean.includes(" ") || /^US\d{10}$/i.test(clean)) return [clean];
  if (clean.includes(".") || clean.includes("-") || source !== "revolut") return [clean];

  if (currency === "EUR") return [clean, `${clean}.AS`, `${clean}.DE`, `${clean}.PA`, `${clean}.MI`];
  if (currency === "GBP") return [clean, `${clean}.L`];
  if (currency === "CAD") return [clean, `${clean}.TO`, `${clean}.V`];
  return [clean];
}

function sanitizePositions(values: ImportedPortfolioPosition[]) {
  return values
    .map((position) => ({
      symbol: normalizeSymbol(position.symbol),
      quantity: finiteNumber(position.quantity),
      fallbackPrice: finitePositive(position.fallbackPrice) ? position.fallbackPrice : undefined,
      currency: normalizeCurrency(position.currency),
      reportedValue: finiteNumber(position.reportedValue),
      fxToBase: finitePositive(position.fxToBase) ? position.fxToBase : undefined,
      name: String(position.name ?? "").slice(0, 120),
    }))
    .filter((position) => position.symbol && Number.isFinite(position.quantity) && position.quantity !== 0);
}

function sanitizeCash(values: ImportedPortfolioCash[]) {
  return values
    .map((item) => ({
      currency: normalizeCurrency(item.currency),
      amount: finiteNumber(item.amount),
      fxToBase: finitePositive(item.fxToBase) ? item.fxToBase : undefined,
    }))
    .filter((item) => item.currency && Number.isFinite(item.amount));
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 32);
}

function normalizeCurrency(value?: string) {
  const match = String(value ?? "").toUpperCase().match(/\b[A-Z]{3}\b/);
  return match?.[0] ?? "";
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}
