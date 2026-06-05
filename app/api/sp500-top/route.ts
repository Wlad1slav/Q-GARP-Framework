import { NextResponse } from "next/server";
import { ANALYSIS_CACHE_TTL_MS, ANALYSIS_CACHE_TTL_SECONDS, getCachedAnalysis } from "@/lib/analysis-service";
import type { AnalysisResult } from "@/lib/analysis-types";
import type { Sp500IndicatorId, Sp500TopItem } from "@/lib/sp500-top-types";
import { sp500IndicatorIds, type Sp500TopFailure, type Sp500TopResponse } from "@/lib/sp500-top-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH_SIZE = 1;
const CONCURRENCY = 1;
const CACHE_VERSION = "full-v4";
const TICKER_TIMEOUT_MS = 30_000;

const analysisCache = new Map<string, { item: Sp500TopItem; expiresAt: number }>();

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const symbols = parseTickerList(searchParams.get("tickers")).slice(0, MAX_BATCH_SIZE);

  if (!symbols.length) {
    return NextResponse.json({ message: "Provide at least one ticker in the tickers query parameter." }, { status: 400 });
  }

  const outcomes = await mapWithConcurrency(symbols, CONCURRENCY, getTopItemWithTimeout);
  const items: Sp500TopItem[] = [];
  const failed: Sp500TopFailure[] = [];
  let cached = 0;

  for (const outcome of outcomes) {
    if (outcome.result) {
      items.push(outcome.result.item);
      if (outcome.result.cached) cached += 1;
      continue;
    }

    failed.push({
      symbol: outcome.value,
      message: outcome.error instanceof Error ? outcome.error.message : "Ticker could not be scored.",
    });
  }

  const payload: Sp500TopResponse = {
    items,
    failed,
    asOf: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    cached,
    maxBatchSize: MAX_BATCH_SIZE,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": `private, max-age=${ANALYSIS_CACHE_TTL_SECONDS}, stale-while-revalidate=600`,
      "X-Analysis-Priority": "sp500",
    },
  });
}

function parseTickerList(value: string | null) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toUpperCase().replace(".", "-").replace(/\s+/g, ""))
        .filter(Boolean),
    ),
  );
}

async function getTopItem(symbol: string): Promise<{ item: Sp500TopItem; cached: boolean }> {
  const cacheKey = `${CACHE_VERSION}:${symbol}`;
  const now = Date.now();
  const cached = analysisCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return { item: cached.item, cached: true };
  }

  const { result: analysis, cached: analysisCached } = await getCachedAnalysis({
    ticker: symbol,
    peers: [],
    language: "en",
    priority: "sp500",
  });
  const item = toTopItem(analysis);

  analysisCache.set(cacheKey, {
    item,
    expiresAt: now + ANALYSIS_CACHE_TTL_MS,
  });

  return { item, cached: analysisCached };
}

async function getTopItemWithTimeout(symbol: string): Promise<{ item: Sp500TopItem; cached: boolean }> {
  return withTimeout(getTopItem(symbol), TICKER_TIMEOUT_MS, `${symbol} exceeded the server time budget.`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function toTopItem(analysis: AnalysisResult): Sp500TopItem {
  const indicators = Object.fromEntries(
    analysis.indicators.map((indicator) => [
      indicator.id,
      {
        id: indicator.id,
        score: indicator.score,
        confidence: indicator.confidence,
        tone: indicator.tone,
        weight: indicator.weight,
      },
    ]),
  ) as Record<Sp500IndicatorId, Sp500TopItem["indicators"][Sp500IndicatorId]>;

  for (const id of sp500IndicatorIds) {
    indicators[id] ??= {
      id,
      score: 0,
      confidence: 0,
      tone: "unknown",
      weight: 0,
    };
  }

  return {
    symbol: analysis.symbol,
    name: analysis.name,
    exchange: analysis.exchange,
    sector: analysis.sector,
    industry: analysis.industry,
    currency: analysis.currency,
    price: analysis.price,
    marketCap: analysis.marketCap,
    marketCapValue: analysis.marketCapValue,
    asOf: analysis.asOf,
    score: analysis.score,
    rawScore: analysis.rawScore,
    confidence: analysis.confidence,
    riskPenalty: analysis.riskPenalty,
    tone: analysis.tone,
    indicators,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<Array<{ value: T; result?: R; error?: unknown }>> {
  const results = new Array<{ value: T; result?: R; error?: unknown }>(values.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = {
          value: values[index],
          result: await worker(values[index]),
        };
      } catch (error) {
        results[index] = {
          value: values[index],
          error,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}
