export type MetricTone = "good" | "watch" | "bad" | "unknown";
export type PeerSource = "recommended" | "manual";

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
  asOf: string;
  score: number;
  tone: MetricTone;
  label: string;
  indicators: IndicatorResult[];
  peerSymbols: string[];
  recommendedPeerSymbols: string[];
  peerSource: PeerSource;
  dataNotes: string[];
}
