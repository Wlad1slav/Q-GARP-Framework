import type { AnalysisResult } from "./analysis-types";
import { analyzeTicker, type AnalyzeTickerOptions } from "./finance-analysis";
import type { Language } from "./i18n";
import { defaultLanguage, normalizeLanguage } from "./i18n";
import { PriorityTaskQueue, type QueuePriority } from "./priority-task-queue";
import { normalizeTicker } from "./ticker";

type AnalysisCacheEntry = {
  result: AnalysisResult;
  expiresAt: number;
};

type AnalysisQueueState = {
  cache: Map<string, AnalysisCacheEntry>;
  inFlight: Map<string, { promise: Promise<AnalysisResult>; setPriority: (priority: QueuePriority) => void }>;
  queue: PriorityTaskQueue;
};

type CachedAnalysisRequest = {
  ticker: string;
  peers?: string[];
  language?: Language;
  priority: QueuePriority;
  options?: Omit<AnalyzeTickerOptions, "queuePriority">;
};

export type CachedAnalysisResponse = {
  result: AnalysisResult;
  cached: boolean;
};

export const ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ANALYSIS_CACHE_TTL_SECONDS = ANALYSIS_CACHE_TTL_MS / 1000;

const ANALYSIS_QUEUE_STATE_KEY = "__investRateAnalysisQueueState";
const CACHE_VERSION = "analysis-v4";
const MAX_CACHE_ENTRIES = 700;

declare global {
  var __investRateAnalysisQueueState: AnalysisQueueState | undefined;
}

function getState() {
  globalThis[ANALYSIS_QUEUE_STATE_KEY] ??= {
    cache: new Map(),
    inFlight: new Map(),
    queue: new PriorityTaskQueue({
      concurrency: 2,
    }),
  };

  return globalThis[ANALYSIS_QUEUE_STATE_KEY];
}

export async function getCachedAnalysis(request: CachedAnalysisRequest): Promise<CachedAnalysisResponse> {
  const language = normalizeLanguage(request.language ?? defaultLanguage);
  const symbol = normalizeTicker(request.ticker);
  const peers = normalizePeers(request.peers ?? [], symbol);
  const options = request.options ?? {};
  const key = cacheKey({ symbol, peers, language, options });
  const state = getState();
  const now = Date.now();
  const cached = state.cache.get(key);

  if (cached && cached.expiresAt > now) {
    return { result: cached.result, cached: true };
  }

  const inFlight = state.inFlight.get(key);
  if (inFlight) {
    if (request.priority === "single") {
      inFlight.setPriority("single");
    }
    return { result: await inFlight.promise, cached: false };
  }

  const queued = state.queue.enqueueWithHandle(request.priority, async () => {
    const fresh = state.cache.get(key);
    if (fresh && fresh.expiresAt > Date.now()) {
      return fresh.result;
    }

    const result = await analyzeTicker(symbol, peers, language, {
      ...options,
      queuePriority: request.priority,
    });

    state.cache.set(key, {
      result,
      expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
    });
    pruneCache(state.cache);
    return result;
  });

  state.inFlight.set(key, {
    promise: queued.promise,
    setPriority: queued.setPriority,
  });

  try {
    return { result: await queued.promise, cached: false };
  } finally {
    state.inFlight.delete(key);
  }
}

function cacheKey({
  symbol,
  peers,
  language,
  options,
}: {
  symbol: string;
  peers: string[];
  language: Language;
  options: Omit<AnalyzeTickerOptions, "queuePriority">;
}) {
  const optionBits = [
    options.skipRecommendedPeers ? "no-recs" : "recs",
    options.skipPeerSnapshots ? "no-peers" : "peers",
    options.skipHistoricalValuations ? "no-history" : "history",
  ].join(":");

  return [CACHE_VERSION, symbol, language, peers.join(","), optionBits].join("|");
}

function normalizePeers(values: string[], baseSymbol: string) {
  return Array.from(new Set(values.map(normalizeTicker).filter(Boolean)))
    .filter((symbol) => symbol !== baseSymbol)
    .slice(0, 8);
}

function pruneCache(cache: Map<string, AnalysisCacheEntry>) {
  const now = Date.now();

  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}
