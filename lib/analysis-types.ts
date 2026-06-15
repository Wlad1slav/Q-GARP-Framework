export type MetricTone = "good" | "watch" | "bad" | "unknown";
export type PeerSource = "actual" | "recommended" | "manual";

export const supplementalMetricIds = [
  "totalShareholderYield",
  "fcfYield",
  "impliedUpside",
  "fiftyTwoWeekRangePosition",
  "momentum",
] as const;

export type SupplementalMetricId = (typeof supplementalMetricIds)[number];

export interface EvidenceItem {
  label: string;
  value: string;
}

export interface IndicatorResult {
  id: "double" | "valuation" | "growth" | "margins" | "peg";
  title: string;
  subtitle: string;
  verdict: string;
  tone: MetricTone;
  score: number;
  weight: number;
  confidence: number;
  evidence: EvidenceItem[];
}

export interface AnalysisResult {
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  currency?: string;
  price?: string;
  marketCap?: string;
  marketCapValue?: number;
  asOf: string;
  score: number;
  rawScore: number;
  confidence: number;
  riskPenalty: number;
  scoringProfile: string;
  sectorWeightsEnabled: boolean;
  riskFlags: string[];
  tone: MetricTone;
  label: string;
  indicators: IndicatorResult[];
  peerSymbols: string[];
  recommendedPeerSymbols: string[];
  peerSource: PeerSource;
  dataNotes: string[];
  actualPeersSourceUrl?: string;
}

export interface SupplementalMetricResult {
  id: SupplementalMetricId;
  value: string;
  detail?: string;
  chart?: SupplementalMetricChart;
}

export interface SupplementalMetricChartPoint {
  date: string;
  price: number;
  average?: number;
}

export interface SupplementalMetricChart {
  currency?: string;
  priceLabel: string;
  averageLabel: string;
  points: SupplementalMetricChartPoint[];
}

export interface SupplementalMetricsResult {
  symbol: string;
  asOf: string;
  metrics: SupplementalMetricResult[];
  dataNotes: string[];
}
