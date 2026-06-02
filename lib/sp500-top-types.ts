import type { IndicatorResult, MetricTone } from "./analysis-types";

export type Sp500IndicatorId = IndicatorResult["id"];

export const sp500IndicatorIds = ["double", "valuation", "growth", "margins", "peg"] as const satisfies readonly Sp500IndicatorId[];

export interface Sp500IndicatorSnapshot {
  id: Sp500IndicatorId;
  score: number;
  confidence: number;
  tone: MetricTone;
  weight: number;
}

export interface Sp500TopItem {
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  currency?: string;
  price?: string;
  marketCap?: string;
  asOf: string;
  score: number;
  rawScore: number;
  confidence: number;
  riskPenalty: number;
  tone: MetricTone;
  indicators: Record<Sp500IndicatorId, Sp500IndicatorSnapshot>;
}

export interface Sp500TopFailure {
  symbol: string;
  message: string;
}

export interface Sp500TopResponse {
  items: Sp500TopItem[];
  failed: Sp500TopFailure[];
  asOf: string;
  elapsedMs: number;
  cached: number;
  maxBatchSize: number;
}
