import { PriorityTaskQueue, type QueuePriority } from "./priority-task-queue";

type YahooQueueState = {
  cache: Map<string, { value: unknown; expiresAt: number }>;
  inFlight: Map<string, { promise: Promise<unknown>; setPriority: (priority: QueuePriority) => void }>;
  queue: PriorityTaskQueue;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1200;
const RETRY_DELAYS_MS = [3500, 8000, 15000, 24000];
const YAHOO_QUEUE_STATE_KEY = "__investRateYahooQueueState";

declare global {
  var __investRateYahooQueueState: YahooQueueState | undefined;
}

function getState() {
  globalThis[YAHOO_QUEUE_STATE_KEY] ??= {
    cache: new Map(),
    inFlight: new Map(),
    queue: new PriorityTaskQueue({
      concurrency: 2,
      minStartIntervalMs: 650,
    }),
  };

  return globalThis[YAHOO_QUEUE_STATE_KEY];
}

export function runYahooRequest<T>(priority: QueuePriority, run: () => Promise<T>): Promise<T> {
  return getState().queue.enqueue(priority, () => runWithRetries(run));
}

export async function runCachedYahooRequest<T>(
  cacheKey: string,
  priority: QueuePriority,
  run: () => Promise<T>,
): Promise<T> {
  const state = getState();
  const now = Date.now();
  const cached = state.cache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inFlight = state.inFlight.get(cacheKey);
  if (inFlight) {
    if (priority === "single") {
      inFlight.setPriority("single");
    }
    return (await inFlight.promise) as T;
  }

  const queued = state.queue.enqueueWithHandle(priority, async () => {
    const fresh = state.cache.get(cacheKey);
    if (fresh && fresh.expiresAt > Date.now()) {
      return fresh.value as T;
    }

    const value = await runWithRetries(run);
    state.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    pruneCache(state.cache);
    return value;
  });

  state.inFlight.set(cacheKey, {
    promise: queued.promise,
    setPriority: queued.setPriority,
  });

  try {
    return await queued.promise;
  } finally {
    state.inFlight.delete(cacheKey);
  }
}

async function runWithRetries<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|too many requests|rate.?limit/i.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneCache(cache: Map<string, { value: unknown; expiresAt: number }>) {
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
