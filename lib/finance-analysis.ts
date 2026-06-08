import YahooFinance from "yahoo-finance2";
import { getActualPeerSymbols } from "./actual-peers";
import type { AnalysisResult, EvidenceItem, IndicatorResult, MetricTone, PeerSource } from "./analysis-types";
import { analysisCopy, defaultLanguage, localeForLanguage, normalizeLanguage, type Language } from "./i18n";
import type { QueuePriority } from "./priority-task-queue";
import { normalizeTicker } from "./ticker";
import { runCachedYahooRequest } from "./yahoo-request-queue";

type AnyRecord = Record<string, unknown>;

type StatementRow = AnyRecord & {
  date?: string | number | Date;
};

type FundamentalsModule = "financials" | "cash-flow" | "balance-sheet";
type IndicatorId = IndicatorResult["id"];
type IndicatorWeightMap = Record<IndicatorId, number>;

type PeerSnapshot = {
  symbol: string;
  revenueGrowth: number | undefined;
  earningsGrowth: number | undefined;
  trailingPE: number | undefined;
  forwardPE: number | undefined;
  ps: number | undefined;
  priceToBook: number | undefined;
  evToEbitda: number | undefined;
  profitMargin: number | undefined;
  returnOnEquity: number | undefined;
};

export type AnalyzeTickerOptions = {
  queuePriority?: QueuePriority;
  skipRecommendedPeers?: boolean;
  skipPeerSnapshots?: boolean;
  skipHistoricalValuations?: boolean;
  useSectorWeights?: boolean;
};

const DOUBLE_CAGR = Math.pow(2, 1 / 5) - 1;
const MISSING_SIGNAL_SCORE = 42;
const MISSING_CRITICAL_SCORE = 28;
const DEFAULT_SIGNAL_WEIGHT = 1;

const DEFAULT_INDICATOR_WEIGHTS: IndicatorWeightMap = {
  double: 0.16,
  valuation: 0.24,
  growth: 0.24,
  margins: 0.24,
  peg: 0.12,
};

type ScoreSignal = {
  score: number | undefined;
  weight?: number;
  missingScore?: number;
  critical?: boolean;
};

type ScoreBreakdown = {
  score: number;
  confidence: number;
  observedWeight: number;
  totalWeight: number;
};

type ScoringProfile = {
  label: Record<Language, string>;
  weights: IndicatorWeightMap;
  isFinancial: boolean;
  isCyclical: boolean;
  isSoftwareLike: boolean;
  growth: {
    revenueWatch: number;
    revenueGood: number;
    fcfWatch: number;
    fcfGood: number;
    earningsWatch: number;
    earningsGood: number;
  };
  margins: {
    grossWatch: number;
    grossGood: number;
    operatingWatch: number;
    operatingGood: number;
    profitWatch: number;
    profitGood: number;
    fcfWatch: number;
    fcfGood: number;
    roeWatch: number;
    roeGood: number;
    roicWatch: number;
    roicGood: number;
  };
  leverage: {
    debtToEquityGood: number;
    debtToEquityWatch: number;
    netDebtToFcfGood: number;
    netDebtToFcfWatch: number;
  };
};

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export async function analyzeTicker(
  inputTicker: string,
  manualPeerInput: string[] = [],
  selectedLanguage: Language = defaultLanguage,
  options: AnalyzeTickerOptions = {},
): Promise<AnalysisResult> {
  const language = normalizeLanguage(selectedLanguage);
  const symbol = normalizeTicker(inputTicker);
  if (!symbol) {
    throw new Error(analysisCopy[language].errors.invalidTicker);
  }

  const queuePriority = options.queuePriority ?? "single";
  const period1 = yearStart(-7);
  const [
    quoteSummary,
    annualFinancials,
    annualCashFlow,
    annualBalanceSheet,
    trailingFinancials,
    trailingCashFlow,
    trailingBalanceSheet,
    spySummary,
    defaultPeerGroup,
  ] =
    await Promise.all([
      getQuoteSummary(symbol, undefined, queuePriority),
      getFundamentals(symbol, "annual", "financials", period1, queuePriority),
      getFundamentals(symbol, "annual", "cash-flow", period1, queuePriority),
      getFundamentals(symbol, "annual", "balance-sheet", period1, queuePriority),
      getFundamentals(symbol, "trailing", "financials", period1, queuePriority),
      getFundamentals(symbol, "trailing", "cash-flow", period1, queuePriority),
      getFundamentals(symbol, "trailing", "balance-sheet", period1, queuePriority),
      getQuoteSummary("SPY", ["summaryDetail", "price"], queuePriority),
      options.skipRecommendedPeers
        ? Promise.resolve({ symbols: [], source: "recommended" as const })
        : getDefaultPeerGroup(symbol, queuePriority),
    ]);

  const recommendedPeerSymbols = normalizePeerSymbols(defaultPeerGroup.symbols, symbol);
  const manualPeerSymbols = normalizePeerSymbols(manualPeerInput, symbol);
  const peerSource: PeerSource = manualPeerSymbols.length ? "manual" : defaultPeerGroup.source;
  const peerSymbols = options.skipPeerSnapshots ? [] : peerSource === "manual" ? manualPeerSymbols : recommendedPeerSymbols;
  const peers = options.skipPeerSnapshots ? [] : await getPeerSnapshots(peerSymbols, queuePriority);
  const historicalValuations = options.skipHistoricalValuations
    ? []
    : await getHistoricalValuations(symbol, annualFinancials, annualCashFlow, queuePriority);
  const useSectorWeights = options.useSectorWeights ?? true;

  const data = buildAnalysis({
    symbol,
    quoteSummary,
    annualFinancials,
    annualCashFlow,
    annualBalanceSheet,
    trailingFinancials,
    trailingCashFlow,
    trailingBalanceSheet,
    historicalValuations,
    spySummary,
    peers,
    peerSource,
    language,
    useSectorWeights,
  });

  return {
    ...data,
    peerSymbols,
    recommendedPeerSymbols,
    peerSource,
  };
}

function normalizePeerSymbols(values: string[], baseSymbol: string) {
  return Array.from(new Set(values.map(normalizeTicker).filter(Boolean)))
    .filter((symbol) => symbol !== baseSymbol)
    .slice(0, 8);
}

function yearStart(offset: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + offset, 0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

async function getQuoteSummary(symbol: string, modules?: string[], priority: QueuePriority = "single") {
  const selectedModules =
    modules ??
    [
      "price",
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "earningsTrend",
      "assetProfile",
      "quoteType",
    ];

  return (await runCachedYahooRequest(`quoteSummary:${symbol}:${selectedModules.join(",")}`, priority, () =>
    yahooFinance.quoteSummary(
      symbol,
      {
        formatted: false,
        modules: selectedModules as never,
      },
      { validateResult: false },
    ),
  )) as AnyRecord;
}

async function getFundamentals(
  symbol: string,
  type: "annual" | "trailing",
  module: FundamentalsModule,
  period1: string,
  priority: QueuePriority = "single",
) {
  try {
    const rows = (await runCachedYahooRequest(`fundamentals:${symbol}:${type}:${module}:${period1}`, priority, () =>
      yahooFinance.fundamentalsTimeSeries(
        symbol,
        {
          period1,
          type,
          module,
        },
        { validateResult: false },
      ),
    )) as StatementRow[];

    return sortRows(rows);
  } catch {
    return [];
  }
}

async function getRecommendations(symbol: string, priority: QueuePriority = "single") {
  try {
    const result = (await runCachedYahooRequest(`recommendations:${symbol}`, priority, () =>
      yahooFinance.recommendationsBySymbol(symbol, {}, { validateResult: false }),
    )) as AnyRecord;
    const rows = Array.isArray(result.recommendedSymbols) ? result.recommendedSymbols : [];
    return rows
      .map((item) => (isRecord(item) && typeof item.symbol === "string" ? item.symbol : undefined))
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

async function getDefaultPeerGroup(
  symbol: string,
  priority: QueuePriority = "single",
): Promise<{ symbols: string[]; source: Exclude<PeerSource, "manual"> }> {
  const actualPeerSymbols = normalizePeerSymbols(await getActualPeerSymbols(symbol), symbol);
  if (actualPeerSymbols.length) {
    return {
      symbols: actualPeerSymbols,
      source: "actual",
    };
  }

  return {
    symbols: normalizePeerSymbols((await getRecommendations(symbol, priority)).slice(0, 5), symbol),
    source: "recommended",
  };
}

async function getPeerSnapshots(symbols: string[], priority: QueuePriority): Promise<PeerSnapshot[]> {
  const uniqueSymbols = Array.from(new Set(symbols)).slice(0, 8);
  const snapshots = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        const summary = await getQuoteSummary(symbol, [
          "price",
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
        ], priority);
        const financialData = asRecord(summary.financialData);
        const summaryDetail = asRecord(summary.summaryDetail);
        const keyStats = asRecord(summary.defaultKeyStatistics);
        return {
          symbol,
          revenueGrowth: num(financialData.revenueGrowth),
          earningsGrowth: num(financialData.earningsGrowth),
          trailingPE: firstNumber(summaryDetail.trailingPE, keyStats.trailingPE),
          forwardPE: firstNumber(summaryDetail.forwardPE, keyStats.forwardPE),
          ps: firstNumber(summaryDetail.priceToSalesTrailing12Months, keyStats.priceToSalesTrailing12Months),
          priceToBook: firstNumber(keyStats.priceToBook, summaryDetail.priceToBook),
          evToEbitda: num(keyStats.enterpriseToEbitda),
          profitMargin: firstNumber(financialData.profitMargins, keyStats.profitMargins),
          returnOnEquity: num(financialData.returnOnEquity),
        };
      } catch {
        return undefined;
      }
    }),
  );

  return snapshots.filter((snapshot): snapshot is PeerSnapshot => Boolean(snapshot));
}

async function getHistoricalValuations(
  symbol: string,
  financials: StatementRow[],
  cashFlow: StatementRow[],
  priority: QueuePriority,
) {
  const rows = financials
    .map((financial) => {
      const date = dateValue(financial.date);
      const cash = findRowByTime(cashFlow, financial.date);
      return {
        date,
        revenue: firstNumber(financial.totalRevenue, financial.operatingRevenue, financial.annualTotalRevenue),
        netIncome: firstNumber(financial.netIncome, financial.netIncomeCommonStockholders, financial.annualNetIncome),
        shares: firstNumber(financial.dilutedAverageShares, financial.basicAverageShares, financial.annualDilutedAverageShares),
        fcf: firstNumber(cash?.freeCashFlow, cash?.annualFreeCashFlow),
      };
    })
    .filter((row) => row.date && row.revenue && row.shares);

  if (rows.length < 2) {
    return [];
  }

  const first = rows[0]?.date;
  if (!first) {
    return [];
  }
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - 10);

  try {
    const chartPeriod1 = start.toISOString().slice(0, 10);
    const chart = (await runCachedYahooRequest(`chart:${symbol}:${chartPeriod1}:1d`, priority, () =>
      yahooFinance.chart(
        symbol,
        {
          period1: chartPeriod1,
          interval: "1d",
        },
        { validateResult: false },
      ),
    )) as AnyRecord;
    const prices = chartToPrices(chart);

    return rows
      .map((row) => {
        const close = row.date ? nearestClose(prices, row.date) : undefined;
        if (!close || !row.shares || !row.revenue) return undefined;
        const marketCap = close * row.shares;
        return {
          date: row.date,
          ps: positiveRatio(marketCap, row.revenue),
          pe: positiveRatio(marketCap, row.netIncome),
          pfcf: positiveRatio(marketCap, row.fcf),
        };
      })
      .filter(Boolean) as Array<{ date: Date; ps?: number; pe?: number; pfcf?: number }>;
  } catch {
    return [];
  }
}

function buildAnalysis({
  symbol,
  quoteSummary,
  annualFinancials,
  annualCashFlow,
  annualBalanceSheet,
  trailingFinancials,
  trailingCashFlow,
  trailingBalanceSheet,
  historicalValuations,
  spySummary,
  peers,
  peerSource,
  language,
  useSectorWeights,
}: {
  symbol: string;
  quoteSummary: AnyRecord;
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  annualBalanceSheet: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  trailingBalanceSheet: StatementRow[];
  historicalValuations: Array<{ date: Date; ps?: number; pe?: number; pfcf?: number }>;
  spySummary: AnyRecord;
  peers: PeerSnapshot[];
  peerSource: PeerSource;
  language: Language;
  useSectorWeights: boolean;
}): AnalysisResult {
  const price = asRecord(quoteSummary.price);
  const financialData = asRecord(quoteSummary.financialData);
  const summaryDetail = asRecord(quoteSummary.summaryDetail);
  const keyStats = asRecord(quoteSummary.defaultKeyStatistics);
  const assetProfile = asRecord(quoteSummary.assetProfile);
  const quoteType = asRecord(quoteSummary.quoteType);
  const earningsTrend = asRecord(quoteSummary.earningsTrend);
  const spyDetail = asRecord(spySummary.summaryDetail);

  const latestAnnualFinancial = lastUsefulRow(annualFinancials, ["totalRevenue", "operatingRevenue", "annualTotalRevenue"]);
  const latestAnnualCashFlow = lastUsefulRow(annualCashFlow, ["freeCashFlow", "annualFreeCashFlow"]);
  const latestAnnualBalanceSheet = lastUsefulRow(annualBalanceSheet, ["totalDebt", "stockholdersEquity", "totalAssets"]);
  const latestTrailingFinancial = lastUsefulRow(trailingFinancials, ["totalRevenue", "operatingRevenue", "trailingTotalRevenue"]);
  const latestTrailingCashFlow = lastUsefulRow(trailingCashFlow, ["freeCashFlow", "trailingFreeCashFlow"]);
  const latestTrailingBalanceSheet = lastUsefulRow(trailingBalanceSheet, ["totalDebt", "stockholdersEquity", "totalAssets"]);

  const currentPrice = firstNumber(price.regularMarketPrice, financialData.currentPrice);
  const marketCap = firstNumber(summaryDetail.marketCap, price.marketCap);
  const trailingRevenue = firstNumber(
    latestTrailingFinancial?.totalRevenue,
    latestTrailingFinancial?.operatingRevenue,
    financialData.totalRevenue,
    latestAnnualFinancial?.totalRevenue,
    latestAnnualFinancial?.operatingRevenue,
  );
  const trailingNetIncome = firstNumber(
    latestTrailingFinancial?.netIncome,
    latestTrailingFinancial?.netIncomeCommonStockholders,
    keyStats.netIncomeToCommon,
    latestAnnualFinancial?.netIncome,
    latestAnnualFinancial?.netIncomeCommonStockholders,
  );
  const trailingFcf = firstNumber(
    latestTrailingCashFlow?.freeCashFlow,
    financialData.freeCashflow,
    latestAnnualCashFlow?.freeCashFlow,
  );
  const trailingOperatingIncome = firstNumber(
    latestTrailingFinancial?.operatingIncome,
    latestTrailingFinancial?.totalOperatingIncomeAsReported,
    latestAnnualFinancial?.operatingIncome,
    latestAnnualFinancial?.totalOperatingIncomeAsReported,
  );
  const sbc = firstNumber(
    latestTrailingCashFlow?.stockBasedCompensation,
    latestAnnualCashFlow?.stockBasedCompensation,
  );
  const totalDebt = firstNumber(
    financialData.totalDebt,
    latestTrailingBalanceSheet?.totalDebt,
    latestTrailingBalanceSheet?.shortLongTermDebtTotal,
    latestAnnualBalanceSheet?.totalDebt,
    latestAnnualBalanceSheet?.shortLongTermDebtTotal,
  );
  const totalCash = firstNumber(
    financialData.totalCash,
    latestTrailingBalanceSheet?.cashAndCashEquivalents,
    latestTrailingBalanceSheet?.cashCashEquivalentsAndShortTermInvestments,
    latestAnnualBalanceSheet?.cashAndCashEquivalents,
    latestAnnualBalanceSheet?.cashCashEquivalentsAndShortTermInvestments,
  );
  const stockholdersEquity = firstNumber(
    latestTrailingBalanceSheet?.stockholdersEquity,
    latestTrailingBalanceSheet?.commonStockEquity,
    latestAnnualBalanceSheet?.stockholdersEquity,
    latestAnnualBalanceSheet?.commonStockEquity,
  );
  const investedCapital = addIfAny(totalDebt, stockholdersEquity, negate(totalCash));
  const adjustedFcf = subtractIfBoth(trailingFcf, sbc);
  const sector = stringOrUndefined(assetProfile.sector);
  const industry = stringOrUndefined(assetProfile.industry);
  const detectedProfile = scoringProfileFor(sector, industry);
  const profile = useSectorWeights
    ? detectedProfile
    : {
        ...detectedProfile,
        weights: DEFAULT_INDICATOR_WEIGHTS,
      };

  const current = {
    revenueGrowth: num(financialData.revenueGrowth),
    earningsGrowth: num(financialData.earningsGrowth),
    grossMargin: num(financialData.grossMargins),
    operatingMargin: num(financialData.operatingMargins),
    profitMargin: firstNumber(financialData.profitMargins, keyStats.profitMargins),
    returnOnEquity: num(financialData.returnOnEquity),
    trailingPE: firstNumber(summaryDetail.trailingPE, keyStats.trailingPE),
    forwardPE: firstNumber(summaryDetail.forwardPE, keyStats.forwardPE),
    priceToSales: firstNumber(summaryDetail.priceToSalesTrailing12Months, positiveRatio(marketCap, trailingRevenue)),
    pfcf: positiveRatio(marketCap, trailingFcf),
    priceToBook: firstNumber(keyStats.priceToBook, summaryDetail.priceToBook),
    evToEbitda: num(keyStats.enterpriseToEbitda),
    peg: num(keyStats.pegRatio),
    marketPE: num(spyDetail.trailingPE),
    currentPrice,
    marketCap,
    trailingRevenue,
    trailingNetIncome,
    trailingFcf,
    trailingOperatingIncome,
    fcfMargin: ratio(trailingFcf, trailingRevenue),
    adjustedFcf,
    adjustedFcfMargin: ratio(adjustedFcf, trailingRevenue),
    sbc,
    sbcToRevenue: positiveRatio(sbc, trailingRevenue),
    sbcToFcf: positiveRatio(sbc, trailingFcf),
    totalDebt,
    totalCash,
    stockholdersEquity,
    debtToEquity: ratio(totalDebt, stockholdersEquity),
    netDebtToFcf: ratio(subtractIfBoth(totalDebt, totalCash), trailingFcf),
    returnOnInvestedCapital: ratio(trailingOperatingIncome, investedCapital),
  };

  const growth = {
    revenueCagr3y: cagrFromRows(annualFinancials, "totalRevenue", "operatingRevenue", "annualTotalRevenue"),
    netIncomeCagr3y: directionalGrowthFromRows(annualFinancials, "netIncome", "netIncomeCommonStockholders", "annualNetIncome"),
    fcfCagr3y: directionalGrowthFromRows(annualCashFlow, "freeCashFlow", "annualFreeCashFlow"),
    forwardRevenueGrowth: trendGrowth(earningsTrend, "revenueEstimate"),
    forwardEarningsGrowth: trendGrowth(earningsTrend, "earningsEstimate"),
  };

  const marginTrend = buildMarginTrend(annualFinancials);
  const peerMedians = {
    revenueGrowth: median(peers.map((peer) => peer.revenueGrowth)),
    earningsGrowth: median(peers.map((peer) => peer.earningsGrowth)),
    trailingPE: median(peers.map((peer) => peer.trailingPE)),
    forwardPE: median(peers.map((peer) => peer.forwardPE)),
    ps: median(peers.map((peer) => peer.ps)),
    priceToBook: median(peers.map((peer) => peer.priceToBook)),
    evToEbitda: median(peers.map((peer) => peer.evToEbitda)),
    profitMargin: median(peers.map((peer) => peer.profitMargin)),
    returnOnEquity: median(peers.map((peer) => peer.returnOnEquity)),
  };

  const historicalMedians = {
    ps: median(historicalValuations.map((item) => item.ps)),
    pe: median(historicalValuations.map((item) => item.pe)),
    pfcf: median(historicalValuations.map((item) => item.pfcf)),
  };

  const indicators = [
    buildDoubleIndicator(growth, profile, language),
    buildValuationIndicator(current, historicalMedians, peerMedians, profile, language),
    buildGrowthIndicator(current, growth, peerMedians, profile, language),
    buildMarginsIndicator(current, growth, marginTrend, peerMedians, profile, language),
    buildPegIndicator(current, growth, profile, language),
  ];

  const scoreSummary = buildScoreSummary({
    indicators,
    current,
    annualFinancials,
    annualCashFlow,
    trailingFinancials,
    trailingCashFlow,
    peers,
    historicalValuations,
    peerSource,
    profile,
    language,
  });
  const score = scoreSummary.score;
  const tone = toneFromScore(score, scoreSummary.confidence / 100);
  const label = labelFromScore(score, tone, language);
  const dataNotes = buildDataNotes({
    annualFinancials,
    annualCashFlow,
    annualBalanceSheet,
    trailingFinancials,
    trailingCashFlow,
    trailingBalanceSheet,
    peers,
    historicalValuations,
    peerSource,
    scoreSummary,
    language,
    sectorWeightsEnabled: useSectorWeights,
  });

  return {
    symbol: String(price.symbol ?? quoteType.symbol ?? symbol),
    name: String(price.shortName ?? price.longName ?? symbol),
    exchange: stringOrUndefined(price.exchangeName ?? price.fullExchangeName),
    sector,
    industry,
    currency: stringOrUndefined(price.currency ?? financialData.financialCurrency ?? summaryDetail.currency),
    price: formatMoney(current.currentPrice, stringOrUndefined(price.currency), language),
    marketCap: formatCompact(current.marketCap, language),
    marketCapValue: current.marketCap,
    asOf: new Date().toISOString(),
    score,
    rawScore: scoreSummary.rawScore,
    confidence: scoreSummary.confidence,
    riskPenalty: scoreSummary.riskPenalty,
    scoringProfile: profile.label[language],
    sectorWeightsEnabled: useSectorWeights,
    riskFlags: scoreSummary.riskFlags,
    tone,
    label,
    indicators,
    peerSymbols: [],
    recommendedPeerSymbols: [],
    peerSource,
    dataNotes,
  };
}

function buildDoubleIndicator(growth: {
  revenueCagr3y?: number;
  netIncomeCagr3y?: number;
  fcfCagr3y?: number;
  forwardRevenueGrowth?: number;
  forwardEarningsGrowth?: number;
}, profile: ScoringProfile, language: Language): IndicatorResult {
  const copy = analysisCopy[language].indicators.double;
  const signals = scoreSignals([
    { score: growthPaceSignal(growth.revenueCagr3y, DOUBLE_CAGR), weight: 1.25, critical: true },
    { score: growthPaceSignal(growth.netIncomeCagr3y, DOUBLE_CAGR), weight: 1.05, critical: true },
    { score: growthPaceSignal(growth.fcfCagr3y, DOUBLE_CAGR), weight: profile.isFinancial ? 0.25 : 1, critical: !profile.isFinancial },
    { score: growthPaceSignal(growth.forwardRevenueGrowth, DOUBLE_CAGR), weight: 0.55 },
    { score: growthPaceSignal(growth.forwardEarningsGrowth, DOUBLE_CAGR), weight: 0.7 },
  ]);

  const values = [
    growth.revenueCagr3y,
    growth.netIncomeCagr3y,
    growth.fcfCagr3y,
    growth.forwardRevenueGrowth,
    growth.forwardEarningsGrowth,
  ].filter(isFiniteNumber);
  const cagrValues = [growth.revenueCagr3y, growth.netIncomeCagr3y, growth.fcfCagr3y].filter(isFiniteNumber);
  const doubleSignals = values.filter((value) => value >= DOUBLE_CAGR).length;
  const score = signals.score;
  const tone = toneFromScore(score, signals.confidence);

  return {
    id: "double",
    title: copy.title,
    subtitle: copy.subtitle,
    verdict: copy.verdict[tone],
    tone,
    score,
    weight: profile.weights.double,
    confidence: percentScore(signals.confidence),
    evidence: compactEvidence([
      [copy.evidence.requiredCagr, formatPercent(DOUBLE_CAGR, language)],
      [copy.evidence.revenueCagr3y, formatPercent(growth.revenueCagr3y, language)],
      [copy.evidence.netIncomeCagr3y, formatPercent(growth.netIncomeCagr3y, language)],
      [copy.evidence.fcfCagr3y, formatPercent(growth.fcfCagr3y, language)],
      [copy.evidence.epsForecast, formatPercent(growth.forwardEarningsGrowth, language)],
      cagrValues.length ? [copy.evidence.doubleSignals, `${doubleSignals}/${values.length}`] : undefined,
    ], language),
  };
}

function buildValuationIndicator(
  current: {
    trailingPE?: number;
    forwardPE?: number;
    priceToSales?: number;
    pfcf?: number;
    priceToBook?: number;
    evToEbitda?: number;
    marketPE?: number;
    trailingNetIncome?: number;
    trailingFcf?: number;
  },
  history: { ps?: number; pe?: number; pfcf?: number },
  peers: { trailingPE?: number; forwardPE?: number; ps?: number; priceToBook?: number; evToEbitda?: number },
  profile: ScoringProfile,
  language: Language,
): IndicatorResult {
  const copy = analysisCopy[language].indicators.valuation;
  const pfcfWeight = profile.isFinancial ? 0.25 : 1;
  const psWeight = profile.isFinancial ? 0.2 : 0.75;
  const evWeight = profile.isFinancial ? 0 : 0.7;
  const priceToBookWeight = profile.isFinancial ? 1 : profile.isCyclical ? 0.55 : 0.25;
  const signals = scoreSignals([
    { score: valuationDiscountSignal(current.trailingPE, current.marketPE), weight: 0.7 },
    { score: valuationDiscountSignal(current.trailingPE, peers.trailingPE), weight: 1, critical: true },
    { score: valuationDiscountSignal(current.forwardPE, peers.forwardPE), weight: 0.8 },
    { score: valuationDiscountSignal(current.trailingPE, history.pe), weight: 0.85 },
    { score: valuationDiscountSignal(current.priceToSales, history.ps), weight: psWeight },
    { score: valuationDiscountSignal(current.priceToSales, peers.ps), weight: psWeight * 0.8 },
    { score: valuationDiscountSignal(current.pfcf, history.pfcf), weight: pfcfWeight, critical: !profile.isFinancial },
    { score: valuationDiscountSignal(current.evToEbitda, peers.evToEbitda), weight: evWeight },
    { score: valuationDiscountSignal(current.priceToBook, peers.priceToBook), weight: priceToBookWeight },
    {
      score: profile.isFinancial ? lowerIsBetterSignal(current.priceToBook, 1.4, 2.6) : undefined,
      weight: profile.isFinancial ? 0.8 : 0,
    },
    { score: signedProfitSignal(current.trailingNetIncome), weight: 0.7, missingScore: MISSING_SIGNAL_SCORE },
    {
      score: profile.isFinancial ? undefined : signedProfitSignal(current.trailingFcf),
      weight: profile.isFinancial ? 0 : 0.85,
      critical: !profile.isFinancial,
    },
  ]);
  const score = signals.score;
  const tone = toneFromScore(score, signals.confidence);

  return {
    id: "valuation",
    title: copy.title,
    subtitle: copy.subtitle,
    verdict: copy.verdict[tone],
    tone,
    score,
    weight: profile.weights.valuation,
    confidence: percentScore(signals.confidence),
    evidence: compactEvidence([
      ["P/E", formatMultiple(current.trailingPE, language)],
      ["P/E SPY", formatMultiple(current.marketPE, language)],
      ["P/E peers", formatMultiple(peers.trailingPE, language)],
      [copy.evidence.peHistory, formatMultiple(history.pe, language)],
      ["P/S", formatMultiple(current.priceToSales, language)],
      [copy.evidence.psHistory, formatMultiple(history.ps, language)],
      ["P/FCF", formatMultiple(current.pfcf, language)],
      [copy.evidence.pfcfHistory, formatMultiple(history.pfcf, language)],
      ["P/B", formatMultiple(current.priceToBook, language)],
      ["P/B peers", formatMultiple(peers.priceToBook, language)],
    ], language),
  };
}

function buildGrowthIndicator(
  current: {
    revenueGrowth?: number;
    earningsGrowth?: number;
  },
  growth: {
    revenueCagr3y?: number;
    netIncomeCagr3y?: number;
    fcfCagr3y?: number;
    forwardRevenueGrowth?: number;
    forwardEarningsGrowth?: number;
  },
  peers: { revenueGrowth?: number; earningsGrowth?: number },
  profile: ScoringProfile,
  language: Language,
): IndicatorResult {
  const copy = analysisCopy[language].indicators.growth;
  const signals = scoreSignals([
    { score: premiumSignal(current.revenueGrowth, peers.revenueGrowth), weight: 0.9 },
    { score: premiumSignal(current.earningsGrowth, peers.earningsGrowth), weight: 0.75 },
    { score: premiumSignal(growth.forwardRevenueGrowth, peers.revenueGrowth), weight: 0.55 },
    {
      score: thresholdSignal(growth.revenueCagr3y, profile.growth.revenueWatch, profile.growth.revenueGood),
      weight: 1.15,
      critical: true,
    },
    {
      score: thresholdSignal(growth.netIncomeCagr3y, profile.growth.earningsWatch, profile.growth.earningsGood),
      weight: 0.8,
    },
    {
      score: thresholdSignal(growth.fcfCagr3y, profile.growth.fcfWatch, profile.growth.fcfGood),
      weight: profile.isFinancial ? 0.25 : 1,
      critical: !profile.isFinancial,
    },
    { score: thresholdSignal(growth.forwardRevenueGrowth, profile.growth.revenueWatch, profile.growth.revenueGood), weight: 0.55 },
    { score: thresholdSignal(growth.forwardEarningsGrowth, profile.growth.earningsWatch, profile.growth.earningsGood), weight: 0.6 },
  ]);
  const score = signals.score;
  const tone = toneFromScore(score, signals.confidence);

  return {
    id: "growth",
    title: copy.title,
    subtitle: copy.subtitle,
    verdict: copy.verdict[tone],
    tone,
    score,
    weight: profile.weights.growth,
    confidence: percentScore(signals.confidence),
    evidence: compactEvidence([
      [copy.evidence.revenueYoy, formatPercent(current.revenueGrowth, language)],
      [copy.evidence.revenuePeers, formatPercent(peers.revenueGrowth, language)],
      [copy.evidence.epsYoy, formatPercent(current.earningsGrowth, language)],
      [copy.evidence.epsPeers, formatPercent(peers.earningsGrowth, language)],
      [copy.evidence.revenueCagr, formatPercent(growth.revenueCagr3y, language)],
      [copy.evidence.netIncomeCagr, formatPercent(growth.netIncomeCagr3y, language)],
      [copy.evidence.fcfCagr, formatPercent(growth.fcfCagr3y, language)],
      [copy.evidence.forwardRevenue, formatPercent(growth.forwardRevenueGrowth, language)],
    ], language),
  };
}

function buildMarginsIndicator(
  current: {
    grossMargin?: number;
    operatingMargin?: number;
    profitMargin?: number;
    fcfMargin?: number;
    returnOnEquity?: number;
    returnOnInvestedCapital?: number;
    revenueGrowth?: number;
    debtToEquity?: number;
    netDebtToFcf?: number;
  },
  growth: { revenueCagr3y?: number },
  trend: {
    grossDelta?: number;
    operatingDelta?: number;
    netDelta?: number;
  },
  peers: { profitMargin?: number; returnOnEquity?: number },
  profile: ScoringProfile,
  language: Language,
): IndicatorResult {
  const copy = analysisCopy[language].indicators.margins;
  const grossWeight = profile.isFinancial ? 0 : profile.isSoftwareLike ? 0.85 : 0.45;
  const operatingWeight = profile.isFinancial ? 0.25 : 0.85;
  const fcfWeight = profile.isFinancial ? 0.2 : 0.85;
  const roicWeight = profile.isFinancial ? 0 : 0.65;
  const leverageWeight = profile.isFinancial ? 0.15 : 0.55;
  const signals = scoreSignals([
    { score: thresholdSignal(trend.grossDelta, -0.01, 0.02), weight: grossWeight * 0.45 },
    { score: thresholdSignal(trend.operatingDelta, -0.01, 0.02), weight: operatingWeight * 0.55 },
    { score: thresholdSignal(trend.netDelta, -0.01, 0.02), weight: 0.55 },
    { score: thresholdSignal(current.grossMargin, profile.margins.grossWatch, profile.margins.grossGood), weight: grossWeight },
    {
      score: thresholdSignal(current.operatingMargin, profile.margins.operatingWatch, profile.margins.operatingGood),
      weight: operatingWeight,
    },
    { score: thresholdSignal(current.profitMargin, profile.margins.profitWatch, profile.margins.profitGood), weight: 1, critical: true },
    { score: thresholdSignal(current.fcfMargin, profile.margins.fcfWatch, profile.margins.fcfGood), weight: fcfWeight },
    { score: premiumSignal(current.profitMargin, peers.profitMargin), weight: 0.7 },
    { score: premiumSignal(current.returnOnEquity, peers.returnOnEquity), weight: 0.45 },
    { score: thresholdSignal(current.returnOnEquity, profile.margins.roeWatch, profile.margins.roeGood), weight: 0.75 },
    {
      score: thresholdSignal(current.returnOnInvestedCapital, profile.margins.roicWatch, profile.margins.roicGood),
      weight: roicWeight,
    },
    {
      score: lowerIsBetterSignal(current.debtToEquity, profile.leverage.debtToEquityGood, profile.leverage.debtToEquityWatch),
      weight: leverageWeight,
    },
    {
      score: lowerIsBetterSignal(current.netDebtToFcf, profile.leverage.netDebtToFcfGood, profile.leverage.netDebtToFcfWatch, {
        negativeIsGood: true,
      }),
      weight: profile.isFinancial ? 0 : 0.5,
    },
    { score: thresholdSignal(current.revenueGrowth ?? growth.revenueCagr3y, 0, profile.growth.revenueWatch), weight: 0.35 },
  ]);
  const score = signals.score;
  const tone = toneFromScore(score, signals.confidence);

  return {
    id: "margins",
    title: copy.title,
    subtitle: copy.subtitle,
    verdict: copy.verdict[tone],
    tone,
    score,
    weight: profile.weights.margins,
    confidence: percentScore(signals.confidence),
    evidence: compactEvidence([
      [copy.evidence.grossMargin, formatPercent(current.grossMargin, language)],
      [copy.evidence.grossChange3y, formatPp(trend.grossDelta, language)],
      [copy.evidence.operatingMargin, formatPercent(current.operatingMargin, language)],
      [copy.evidence.operatingChange, formatPp(trend.operatingDelta, language)],
      [copy.evidence.netMargin, formatPercent(current.profitMargin, language)],
      [copy.evidence.fcfMargin, formatPercent(current.fcfMargin, language)],
      [copy.evidence.roe, formatPercent(current.returnOnEquity, language)],
      [copy.evidence.roic, formatPercent(current.returnOnInvestedCapital, language)],
      [copy.evidence.debtToEquity, formatMultipleAllowingZero(current.debtToEquity, language)],
    ], language),
  };
}

function buildPegIndicator(
  current: {
    peg?: number;
    forwardPE?: number;
    trailingPE?: number;
    trailingRevenue?: number;
    trailingFcf?: number;
    adjustedFcf?: number;
    sbc?: number;
    sbcToRevenue?: number;
    sbcToFcf?: number;
  },
  growth: {
    forwardEarningsGrowth?: number;
    netIncomeCagr3y?: number;
  },
  profile: ScoringProfile,
  language: Language,
): IndicatorResult {
  const copy = analysisCopy[language].indicators.peg;
  const growthForPeg = firstNumber(growth.forwardEarningsGrowth, growth.netIncomeCagr3y);
  const basePeg = firstNumber(
    current.peg,
    growthForPeg && growthForPeg > 0 ? (current.forwardPE ?? current.trailingPE ?? 0) / (growthForPeg * 100) : undefined,
  );
  const sbcToRevenue = current.sbcToRevenue ?? positiveRatio(current.sbc, current.trailingRevenue);
  const sbcToFcf = current.sbcToFcf ?? positiveRatio(current.sbc, current.trailingFcf);
  const adjustedFcf = current.adjustedFcf ?? subtractIfBoth(current.trailingFcf, current.sbc);
  const adjustment = current.trailingFcf && adjustedFcf && adjustedFcf > 0 ? current.trailingFcf / adjustedFcf : undefined;
  const adjustedPeg = basePeg && adjustment ? basePeg * adjustment : basePeg;

  const fcfWeight = profile.isFinancial ? 0.2 : 0.85;
  const signals = scoreSignals([
    { score: pegSignal(adjustedPeg), weight: 1.15, critical: true },
    { score: growthForPegSignal(growthForPeg), weight: 0.65, critical: true },
    { score: lowerIsBetterSignal(sbcToRevenue, 0.03, 0.1), weight: 0.75 },
    { score: lowerIsBetterSignal(sbcToFcf, 0.08, 0.25), weight: fcfWeight },
    { score: signedProfitSignal(current.trailingFcf), weight: fcfWeight, critical: !profile.isFinancial },
    { score: signedProfitSignal(adjustedFcf), weight: fcfWeight, critical: !profile.isFinancial },
  ]);
  const score = signals.score;
  const tone = toneFromScore(score, signals.confidence);

  return {
    id: "peg",
    title: copy.title,
    subtitle: copy.subtitle,
    verdict: copy.verdict[tone],
    tone,
    score,
    weight: profile.weights.peg,
    confidence: percentScore(signals.confidence),
    evidence: compactEvidence([
      [copy.evidence.pegYahoo, formatMultiple(basePeg, language)],
      [copy.evidence.pegWithSbc, formatMultiple(adjustedPeg, language)],
      [copy.evidence.sbcRevenue, formatPercent(sbcToRevenue, language)],
      [copy.evidence.sbcFcf, formatPercent(sbcToFcf, language)],
      [copy.evidence.adjustedFcf, formatCompact(adjustedFcf, language) ?? analysisCopy[language].notAvailable],
      [copy.evidence.epsGrowth, formatPercent(growthForPeg, language)],
    ], language),
  };
}

function buildMarginTrend(rows: StatementRow[]) {
  const usable = rows
    .map((row) => {
      const revenue = firstNumber(row.totalRevenue, row.operatingRevenue, row.annualTotalRevenue);
      const grossProfit = firstNumber(row.grossProfit, row.annualGrossProfit);
      const operatingIncome = firstNumber(row.operatingIncome, row.totalOperatingIncomeAsReported, row.annualOperatingIncome);
      const netIncome = firstNumber(row.netIncome, row.netIncomeCommonStockholders, row.annualNetIncome);
      return {
        gross: ratio(grossProfit, revenue),
        operating: ratio(operatingIncome, revenue),
        net: ratio(netIncome, revenue),
      };
    })
    .filter((row) => row.gross !== undefined || row.operating !== undefined || row.net !== undefined);

  if (usable.length < 2) {
    return {};
  }

  const latest = usable[usable.length - 1];
  const base = usable[Math.max(0, usable.length - 4)];

  return {
    grossDelta: diff(latest.gross, base.gross),
    operatingDelta: diff(latest.operating, base.operating),
    netDelta: diff(latest.net, base.net),
  };
}

function cagrFromRows(rows: StatementRow[], ...keys: string[]) {
  const values = rows
    .map((row) => ({
      date: dateValue(row.date),
      value: firstNumber(...keys.map((key) => row[key])),
    }))
    .filter((row): row is { date: Date; value: number } => Boolean(row.date) && isFiniteNumber(row.value) && row.value > 0);

  if (values.length < 2) {
    return undefined;
  }

  const latest = values[values.length - 1];
  const baseIndex = Math.max(0, values.length - 4);
  const base = values[baseIndex];
  const years = Math.max(1, (latest.date.getTime() - base.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (base.value <= 0 || latest.value <= 0) {
    return undefined;
  }

  return Math.pow(latest.value / base.value, 1 / years) - 1;
}

function directionalGrowthFromRows(rows: StatementRow[], ...keys: string[]) {
  const values = rows
    .map((row) => ({
      date: dateValue(row.date),
      value: firstNumber(...keys.map((key) => row[key])),
    }))
    .filter((row): row is { date: Date; value: number } => Boolean(row.date) && isFiniteNumber(row.value));

  if (values.length < 2) {
    return undefined;
  }

  const latest = values[values.length - 1];
  const baseIndex = Math.max(0, values.length - 4);
  const base = values[baseIndex];

  if (latest.value <= 0) {
    return -0.2;
  }

  if (base.value <= 0) {
    return DOUBLE_CAGR;
  }

  const years = Math.max(1, (latest.date.getTime() - base.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Math.pow(latest.value / base.value, 1 / years) - 1;
}

function trendGrowth(earningsTrend: AnyRecord, key: "revenueEstimate" | "earningsEstimate") {
  const trend = Array.isArray(earningsTrend.trend) ? earningsTrend.trend : [];
  const annualTrend = trend.find((row) => isRecord(row) && row.period === "+1y") ?? trend.find((row) => isRecord(row) && row.period === "0y");
  if (!isRecord(annualTrend)) return undefined;
  const estimate = asRecord(annualTrend[key]);
  return firstNumber(estimate.growth, annualTrend.growth);
}

function premiumSignal(value?: number, benchmark?: number) {
  if (!isFiniteNumber(value) || !isFiniteNumber(benchmark)) {
    return undefined;
  }
  const premium = value - benchmark;
  if (premium >= 0.1) return 100;
  if (premium >= 0.03) return 78;
  if (premium >= -0.02) return 56;
  if (premium >= -0.08) return 36;
  return 14;
}

function thresholdSignal(value: number | undefined, watch: number, good: number) {
  if (!isFiniteNumber(value)) return undefined;
  if (value >= good) return 100;
  if (value >= watch) return 62 + ((value - watch) / Math.max(good - watch, 0.0001)) * 26;
  if (value >= watch - Math.abs(good - watch)) return 34;
  return 12;
}

function pegSignal(peg?: number) {
  if (!isFiniteNumber(peg) || peg <= 0) return undefined;
  if (peg < 1) return 100;
  if (peg < 1.4) return 70;
  if (peg < 2) return 42;
  return 14;
}

function scoringProfileFor(sector?: string, industry?: string): ScoringProfile {
  const text = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();
  const base: ScoringProfile = {
    label: { uk: "Базовий Q-GARP", en: "Baseline Q-GARP" },
    weights: DEFAULT_INDICATOR_WEIGHTS,
    isFinancial: false,
    isCyclical: false,
    isSoftwareLike: false,
    growth: {
      revenueWatch: 0.08,
      revenueGood: 0.16,
      fcfWatch: 0.06,
      fcfGood: 0.14,
      earningsWatch: 0.07,
      earningsGood: 0.15,
    },
    margins: {
      grossWatch: 0.3,
      grossGood: 0.55,
      operatingWatch: 0.08,
      operatingGood: 0.2,
      profitWatch: 0.05,
      profitGood: 0.15,
      fcfWatch: 0.04,
      fcfGood: 0.12,
      roeWatch: 0.1,
      roeGood: 0.22,
      roicWatch: 0.08,
      roicGood: 0.18,
    },
    leverage: {
      debtToEquityGood: 0.6,
      debtToEquityWatch: 1.8,
      netDebtToFcfGood: 1.5,
      netDebtToFcfWatch: 4,
    },
  };

  if (/(financial|bank|insurance|capital market|credit|mortgage|asset management)/i.test(text)) {
    return {
      ...base,
      label: { uk: "Фінансовий профіль", en: "Financials profile" },
      weights: { double: 0.1, valuation: 0.3, growth: 0.17, margins: 0.31, peg: 0.12 },
      isFinancial: true,
      growth: {
        revenueWatch: 0.03,
        revenueGood: 0.08,
        fcfWatch: 0.02,
        fcfGood: 0.06,
        earningsWatch: 0.04,
        earningsGood: 0.1,
      },
      margins: {
        ...base.margins,
        grossWatch: 0,
        grossGood: 0,
        operatingWatch: 0.05,
        operatingGood: 0.15,
        profitWatch: 0.1,
        profitGood: 0.25,
        fcfWatch: 0,
        fcfGood: 0,
        roeWatch: 0.1,
        roeGood: 0.18,
        roicWatch: 0,
        roicGood: 0,
      },
      leverage: {
        debtToEquityGood: 2.5,
        debtToEquityWatch: 8,
        netDebtToFcfGood: 3,
        netDebtToFcfWatch: 8,
      },
    };
  }

  if (/(software|saas|cloud|semiconductor|interactive media|internet|technology)/i.test(text)) {
    return {
      ...base,
      label: { uk: "Tech / software профіль", en: "Tech / software profile" },
      weights: { double: 0.18, valuation: 0.2, growth: 0.27, margins: 0.22, peg: 0.13 },
      isSoftwareLike: true,
      growth: {
        revenueWatch: 0.1,
        revenueGood: 0.22,
        fcfWatch: 0.07,
        fcfGood: 0.18,
        earningsWatch: 0.08,
        earningsGood: 0.18,
      },
      margins: {
        ...base.margins,
        grossWatch: 0.45,
        grossGood: 0.7,
        operatingWatch: 0.08,
        operatingGood: 0.24,
        profitWatch: 0.04,
        profitGood: 0.18,
        fcfWatch: 0.05,
        fcfGood: 0.18,
        roeWatch: 0.12,
        roeGood: 0.26,
        roicWatch: 0.1,
        roicGood: 0.24,
      },
    };
  }

  if (/(energy|materials|industrial|automobile|machinery|airline|shipping|steel|oil|gas|mining|chemical)/i.test(text)) {
    return {
      ...base,
      label: { uk: "Циклічний профіль", en: "Cyclical profile" },
      weights: { double: 0.1, valuation: 0.29, growth: 0.18, margins: 0.28, peg: 0.15 },
      isCyclical: true,
      growth: {
        revenueWatch: 0.03,
        revenueGood: 0.1,
        fcfWatch: 0.03,
        fcfGood: 0.1,
        earningsWatch: 0.04,
        earningsGood: 0.12,
      },
      margins: {
        ...base.margins,
        grossWatch: 0.2,
        grossGood: 0.38,
        operatingWatch: 0.06,
        operatingGood: 0.16,
        profitWatch: 0.04,
        profitGood: 0.12,
        fcfWatch: 0.03,
        fcfGood: 0.1,
      },
      leverage: {
        debtToEquityGood: 0.8,
        debtToEquityWatch: 2.2,
        netDebtToFcfGood: 2,
        netDebtToFcfWatch: 5,
      },
    };
  }

  if (/(utility|consumer staples|healthcare|real estate|reit|telecom)/i.test(text)) {
    return {
      ...base,
      label: { uk: "Захисний профіль", en: "Defensive profile" },
      weights: { double: 0.1, valuation: 0.27, growth: 0.18, margins: 0.3, peg: 0.15 },
      growth: {
        revenueWatch: 0.03,
        revenueGood: 0.09,
        fcfWatch: 0.03,
        fcfGood: 0.09,
        earningsWatch: 0.04,
        earningsGood: 0.1,
      },
      margins: {
        ...base.margins,
        grossWatch: 0.22,
        grossGood: 0.45,
        operatingWatch: 0.06,
        operatingGood: 0.18,
        profitWatch: 0.04,
        profitGood: 0.14,
      },
    };
  }

  return base;
}

function scoreSignals(signals: ScoreSignal[]): ScoreBreakdown {
  const usable = signals.filter((signal) => (signal.weight ?? DEFAULT_SIGNAL_WEIGHT) > 0);
  const totalWeight = usable.reduce((sum, signal) => sum + (signal.weight ?? DEFAULT_SIGNAL_WEIGHT), 0);
  if (!totalWeight) {
    return { score: 0, confidence: 0, observedWeight: 0, totalWeight: 0 };
  }

  let observedWeight = 0;
  const weightedScore = usable.reduce((sum, signal) => {
    const weight = signal.weight ?? DEFAULT_SIGNAL_WEIGHT;
    if (isFiniteNumber(signal.score)) {
      observedWeight += weight;
      return sum + clamp(signal.score, 0, 100) * weight;
    }

    const missingScore = signal.missingScore ?? (signal.critical ? MISSING_CRITICAL_SCORE : MISSING_SIGNAL_SCORE);
    return sum + missingScore * weight;
  }, 0);

  return {
    score: clamp(Math.round(weightedScore / totalWeight), 0, 100),
    confidence: clamp(observedWeight / totalWeight, 0, 1),
    observedWeight,
    totalWeight,
  };
}

function buildScoreSummary({
  indicators,
  current,
  annualFinancials,
  annualCashFlow,
  trailingFinancials,
  trailingCashFlow,
  peers,
  historicalValuations,
  peerSource,
  profile,
  language,
}: {
  indicators: IndicatorResult[];
  current: {
    trailingNetIncome?: number;
    trailingFcf?: number;
    adjustedFcf?: number;
    sbcToRevenue?: number;
    debtToEquity?: number;
    netDebtToFcf?: number;
    stockholdersEquity?: number;
  };
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  peers: PeerSnapshot[];
  historicalValuations: Array<{ date: Date }>;
  peerSource: PeerSource;
  profile: ScoringProfile;
  language: Language;
}) {
  const weighted = weightedAverage(
    indicators.map((indicator) => ({
      value: indicator.score,
      weight: profile.weights[indicator.id],
    })),
  );
  const confidence = weightedAverage(
    indicators.map((indicator) => ({
      value: indicator.confidence / 100,
      weight: profile.weights[indicator.id],
    })),
  );
  const rawScore = clamp(Math.round(weighted ?? 0), 0, 100);
  const risk = buildRiskAssessment({
    current,
    annualFinancials,
    annualCashFlow,
    trailingFinancials,
    trailingCashFlow,
    peers,
    historicalValuations,
    peerSource,
    confidence: confidence ?? 0,
    profile,
    language,
  });
  const confidencePenalty = (confidence ?? 0) < 0.85 ? Math.round((0.85 - (confidence ?? 0)) * 18) : 0;
  const riskPenalty = clamp(Math.round(risk.penalty + confidencePenalty), 0, 30);
  const score = clamp(Math.round(rawScore - riskPenalty), 0, 100);

  return {
    score,
    rawScore,
    confidence: percentScore(confidence ?? 0),
    riskPenalty,
    riskFlags: risk.flags,
    scoringProfile: profile.label[language],
  };
}

function buildRiskAssessment({
  current,
  annualFinancials,
  annualCashFlow,
  trailingFinancials,
  trailingCashFlow,
  peers,
  historicalValuations,
  peerSource,
  confidence,
  profile,
  language,
}: {
  current: {
    trailingNetIncome?: number;
    trailingFcf?: number;
    adjustedFcf?: number;
    sbcToRevenue?: number;
    debtToEquity?: number;
    netDebtToFcf?: number;
    stockholdersEquity?: number;
  };
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  peers: PeerSnapshot[];
  historicalValuations: Array<{ date: Date }>;
  peerSource: PeerSource;
  confidence: number;
  profile: ScoringProfile;
  language: Language;
}) {
  const flags: string[] = [];
  let penalty = 0;
  const copy = riskCopy(language);

  const addRisk = (condition: boolean, value: number, flag: string) => {
    if (!condition) return;
    penalty += value;
    flags.push(flag);
  };

  addRisk(confidence < 0.55, 4, copy.lowConfidence);
  addRisk(peerSource === "recommended", 2, copy.recommendedPeers);
  addRisk(!peers.length, 5, copy.noPeers);
  addRisk(annualFinancials.length < 3, 3, copy.shortHistory);
  addRisk(!annualCashFlow.length || !trailingCashFlow.length, profile.isFinancial ? 1 : 4, copy.missingCashFlow);
  addRisk(!trailingFinancials.length, 3, copy.missingTtm);
  addRisk(historicalValuations.length < 2, 3, copy.noHistory);
  addRisk(isFiniteNumber(current.trailingNetIncome) && current.trailingNetIncome <= 0, 8, copy.negativeEarnings);
  addRisk(!profile.isFinancial && isFiniteNumber(current.trailingFcf) && current.trailingFcf <= 0, 8, copy.negativeFcf);
  addRisk(!profile.isFinancial && isFiniteNumber(current.adjustedFcf) && current.adjustedFcf <= 0, 6, copy.negativeAdjustedFcf);
  addRisk(isFiniteNumber(current.sbcToRevenue) && current.sbcToRevenue > 0.1, 7, copy.highSbc);
  addRisk(isFiniteNumber(current.sbcToRevenue) && current.sbcToRevenue > 0.05 && current.sbcToRevenue <= 0.1, 3, copy.elevatedSbc);
  addRisk(isFiniteNumber(current.stockholdersEquity) && current.stockholdersEquity <= 0, 8, copy.negativeEquity);
  addRisk(
    !profile.isFinancial && isFiniteNumber(current.debtToEquity) && current.debtToEquity > profile.leverage.debtToEquityWatch,
    6,
    copy.highLeverage,
  );
  addRisk(
    !profile.isFinancial && isFiniteNumber(current.netDebtToFcf) && current.netDebtToFcf > profile.leverage.netDebtToFcfWatch,
    5,
    copy.highNetDebt,
  );

  return { penalty: clamp(penalty, 0, 26), flags: Array.from(new Set(flags)).slice(0, 8) };
}

function riskCopy(language: Language) {
  if (language === "en") {
    return {
      lowConfidence: "low data confidence",
      recommendedPeers: "ACTUAL_PEERS group missing; using Yahoo fallback",
      noPeers: "no peer comparison",
      shortHistory: "short financial history",
      missingCashFlow: "cash flow/SBC data missing",
      missingTtm: "TTM financials missing",
      noHistory: "no historical valuation",
      negativeEarnings: "negative earnings",
      negativeFcf: "negative FCF",
      negativeAdjustedFcf: "FCF after SBC is not positive",
      highSbc: "high SBC dilution pressure",
      elevatedSbc: "elevated SBC",
      negativeEquity: "negative equity",
      highLeverage: "high debt/equity",
      highNetDebt: "high net debt/FCF",
    };
  }

  return {
    lowConfidence: "низька довіра до даних",
    recommendedPeers: "ACTUAL_PEERS peer-група відсутня; використовується Yahoo fallback",
    noPeers: "немає peer-порівняння",
    shortHistory: "коротка історія фінзвітності",
    missingCashFlow: "бракує cash flow/SBC",
    missingTtm: "бракує TTM-фінансів",
    noHistory: "немає історичного valuation",
    negativeEarnings: "від'ємний прибуток",
    negativeFcf: "від'ємний FCF",
    negativeAdjustedFcf: "FCF після SBC не додатний",
    highSbc: "високий тиск SBC",
    elevatedSbc: "підвищений SBC",
    negativeEquity: "від'ємний equity",
    highLeverage: "високий debt/equity",
    highNetDebt: "високий net debt/FCF",
  };
}

function valuationDiscountSignal(value?: number, benchmark?: number) {
  if (!isFiniteNumber(benchmark) || benchmark <= 0) return undefined;
  if (!isFiniteNumber(value)) return undefined;
  if (value <= 0) return 10;

  const discount = (benchmark - value) / benchmark;
  if (discount >= 0.25) return 100;
  if (discount >= 0.05) return 74 + ((discount - 0.05) / 0.2) * 20;
  if (discount >= -0.1) return 52 + ((discount + 0.1) / 0.15) * 22;
  if (discount >= -0.3) return 28 + ((discount + 0.3) / 0.2) * 24;
  return 10;
}

function growthPaceSignal(value: number | undefined, target: number) {
  if (!isFiniteNumber(value)) return undefined;
  if (value < 0) return 8;

  const ratioToTarget = value / target;
  if (ratioToTarget >= 1.25) return 100;
  if (ratioToTarget >= 1) return 86 + ((ratioToTarget - 1) / 0.25) * 14;
  if (ratioToTarget >= 0.65) return 55 + ((ratioToTarget - 0.65) / 0.35) * 31;
  if (ratioToTarget >= 0.35) return 28 + ((ratioToTarget - 0.35) / 0.3) * 27;
  return 12 + clamp(ratioToTarget / 0.35, 0, 1) * 16;
}

function lowerIsBetterSignal(
  value: number | undefined,
  good: number,
  watch: number,
  options: { negativeIsGood?: boolean } = {},
) {
  if (!isFiniteNumber(value)) return undefined;
  if (value < 0) return options.negativeIsGood ? 100 : 18;
  if (value <= good) return 100;
  if (value <= watch) return 62 + ((watch - value) / Math.max(watch - good, 0.0001)) * 26;
  if (value <= watch + Math.abs(watch - good)) return 34;
  return 12;
}

function signedProfitSignal(value?: number) {
  if (!isFiniteNumber(value)) return undefined;
  if (value > 0) return 72;
  if (value === 0) return 24;
  return 8;
}

function growthForPegSignal(value?: number) {
  if (!isFiniteNumber(value)) return undefined;
  if (value <= 0) return 8;
  if (value >= DOUBLE_CAGR) return 86;
  if (value >= 0.08) return 62;
  return 34;
}

function weightedAverage(items: Array<{ value: number | undefined; weight: number }>) {
  const usable = items.filter((item) => isFiniteNumber(item.value) && item.weight > 0);
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return undefined;
  return usable.reduce((sum, item) => sum + (item.value ?? 0) * item.weight, 0) / totalWeight;
}

function percentScore(value: number) {
  return clamp(Math.round(value * 100), 0, 100);
}

function toneFromScore(score: number, confidence = 1): MetricTone {
  if (confidence <= 0.15) return "unknown";
  if (score >= 70 && confidence >= 0.55) return "good";
  if (score >= 45) return "watch";
  return "bad";
}

function labelFromScore(score: number, tone: MetricTone, language: Language) {
  const labels = analysisCopy[language].scoreLabels;
  if (tone === "unknown") return labels.unknown;
  return `${labels[tone]}: ${score}/100`;
}

function buildDataNotes({
  annualFinancials,
  annualCashFlow,
  annualBalanceSheet,
  trailingFinancials,
  trailingCashFlow,
  trailingBalanceSheet,
  peers,
  historicalValuations,
  peerSource,
  scoreSummary,
  language,
  sectorWeightsEnabled,
}: {
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  annualBalanceSheet: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  trailingBalanceSheet: StatementRow[];
  peers: PeerSnapshot[];
  historicalValuations: Array<{ date: Date }>;
  peerSource: PeerSource;
  scoreSummary: {
    rawScore: number;
    confidence: number;
    riskPenalty: number;
    riskFlags: string[];
    scoringProfile: string;
  };
  language: Language;
  sectorWeightsEnabled: boolean;
}) {
  const copy = analysisCopy[language].dataNotes;
  const notes: string[] =
    peerSource === "manual" ? [copy.manualPeers] : peerSource === "actual" ? [copy.actualPeers] : [copy.recommendedPeers];
  notes.push(scoringNote(scoreSummary, language, sectorWeightsEnabled));
  if (annualFinancials.length < 3) notes.push(copy.shortHistory);
  if (!annualCashFlow.length || !trailingCashFlow.length) notes.push(copy.missingCashFlow);
  if (!annualBalanceSheet.length || !trailingBalanceSheet.length) notes.push(copy.missingBalanceSheet);
  if (!trailingFinancials.length) notes.push(copy.missingTtm);
  if (!peers.length) notes.push(copy.noPeers);
  if (historicalValuations.length < 2) notes.push(copy.noHistory);
  if (scoreSummary.riskFlags.length) notes.push(riskFlagsNote(scoreSummary.riskFlags, language));
  notes.push(copy.disclaimer);
  return notes;
}

function scoringNote(
  scoreSummary: { rawScore: number; confidence: number; riskPenalty: number; scoringProfile: string },
  language: Language,
  sectorWeightsEnabled: boolean,
) {
  if (language === "en") {
    return `Scoring profile: ${scoreSummary.scoringProfile}; sector weights ${sectorWeightsEnabled ? "on" : "off"}; raw score ${scoreSummary.rawScore}/100, data confidence ${scoreSummary.confidence}/100, risk/data penalty -${scoreSummary.riskPenalty}.`;
  }

  return `Профіль скорингу: ${scoreSummary.scoringProfile}; галузеві ваги ${sectorWeightsEnabled ? "увімкнено" : "вимкнено"}; raw score ${scoreSummary.rawScore}/100, довіра до даних ${scoreSummary.confidence}/100, штраф за ризики/дані -${scoreSummary.riskPenalty}.`;
}

function riskFlagsNote(flags: string[], language: Language) {
  if (language === "en") {
    return `Risk flags: ${flags.join(", ")}.`;
  }

  return `Risk flags: ${flags.join(", ")}.`;
}

function chartToPrices(chart: AnyRecord) {
  if (Array.isArray(chart.quotes)) {
    return chart.quotes
      .map((quote) => {
        const row = asRecord(quote);
        const date = dateValue(row.date);
        const close = num(row.close);
        return date && close ? { date, close } : undefined;
      })
      .filter((item): item is { date: Date; close: number } => Boolean(item));
  }

  const timestamps = Array.isArray(chart.timestamp) ? chart.timestamp : [];
  const indicators = asRecord(chart.indicators);
  const quotes = Array.isArray(indicators.quote) ? indicators.quote : [];
  const quote = asRecord(quotes[0]);
  const closes = Array.isArray(quote.close) ? quote.close : [];

  return timestamps
    .map((stamp, index) => {
      const date = dateValue(stamp);
      const close = num(closes[index]);
      return date && close ? { date, close } : undefined;
    })
    .filter((item): item is { date: Date; close: number } => Boolean(item));
}

function nearestClose(prices: Array<{ date: Date; close: number }>, target: Date) {
  let best: { date: Date; close: number } | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const price of prices) {
    const distance = Math.abs(price.date.getTime() - target.getTime());
    if (distance < bestDistance) {
      best = price;
      bestDistance = distance;
    }
  }

  return bestDistance <= 10 * 24 * 60 * 60 * 1000 ? best?.close : undefined;
}

function lastUsefulRow(rows: StatementRow[], keys: string[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (keys.some((key) => isFiniteNumber(num(rows[index][key])))) {
      return rows[index];
    }
  }
  return undefined;
}

function sortRows(rows: StatementRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = dateValue(a.date)?.getTime() ?? 0;
    const bTime = dateValue(b.date)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

function findRowByTime(rows: StatementRow[], date: StatementRow["date"]) {
  const target = dateValue(date)?.getTime();
  if (!target) return undefined;
  return rows.find((row) => dateValue(row.date)?.getTime() === target);
}

function compactEvidence(items: Array<[string, string] | undefined>, language: Language): EvidenceItem[] {
  const emptyValue = analysisCopy[language].notAvailable;
  return items
    .filter((item): item is [string, string] => Boolean(item))
    .filter(([, value]) => value !== emptyValue)
    .slice(0, 9)
    .map(([label, value]) => ({ label, value }));
}

function median(values: Array<number | undefined>) {
  const clean = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function diff(a?: number, b?: number) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return undefined;
  return a - b;
}

function ratio(a?: number, b?: number) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b) || b === 0) return undefined;
  return a / b;
}

function positiveRatio(a?: number, b?: number) {
  const value = ratio(a, b);
  return value !== undefined && value > 0 ? value : undefined;
}

function subtractIfBoth(a?: number, b?: number) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return undefined;
  return a - b;
}

function addIfAny(...values: Array<number | undefined>) {
  const clean = values.filter(isFiniteNumber);
  if (!clean.length) return undefined;
  return clean.reduce((sum, value) => sum + value, 0);
}

function negate(value?: number) {
  return isFiniteNumber(value) ? -value : undefined;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = num(value);
    if (isFiniteNumber(parsed)) return parsed;
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (isRecord(value)) {
    return num(value.raw);
  }
  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function dateValue(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number") {
    const millis = value < 100000000000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }
  return undefined;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatPercent(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return analysisCopy[language].notAvailable;
  return new Intl.NumberFormat(localeForLanguage(language), {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: Math.abs(value) < 0.1 ? 1 : 0,
  }).format(value);
}

function formatPp(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return analysisCopy[language].notAvailable;
  const pp = value * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(pp)} ${analysisCopy[language].pointSuffix}`;
}

function formatMultiple(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value) || value <= 0) return analysisCopy[language].notAvailable;
  return `${new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 1,
    minimumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)}x`;
}

function formatMultipleAllowingZero(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return analysisCopy[language].notAvailable;
  return `${new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 1,
    minimumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value)}x`;
}

function formatCompact(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return undefined;
  return new Intl.NumberFormat(localeForLanguage(language), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMoney(value: number | undefined, currency = "USD", language: Language) {
  if (!isFiniteNumber(value)) return undefined;
  try {
    return new Intl.NumberFormat(localeForLanguage(language), {
      style: "currency",
      currency,
      maximumFractionDigits: value > 100 ? 0 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits: 2,
    }).format(value);
  }
}
