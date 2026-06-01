import YahooFinance from "yahoo-finance2";
import type { AnalysisResult, EvidenceItem, IndicatorResult, MetricTone, PeerSource } from "./analysis-types";

type AnyRecord = Record<string, unknown>;

type StatementRow = AnyRecord & {
  date?: string | number | Date;
};

type PeerSnapshot = {
  symbol: string;
  revenueGrowth: number | undefined;
  earningsGrowth: number | undefined;
  trailingPE: number | undefined;
  forwardPE: number | undefined;
  ps: number | undefined;
  evToEbitda: number | undefined;
  profitMargin: number | undefined;
};

const DOUBLE_CAGR = Math.pow(2, 1 / 5) - 1;
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export async function analyzeTicker(inputTicker: string, manualPeerInput: string[] = []): Promise<AnalysisResult> {
  const symbol = normalizeTicker(inputTicker);
  if (!symbol) {
    throw new Error("Введіть коректний тікер.");
  }

  const period1 = yearStart(-7);
  const [quoteSummary, annualFinancials, annualCashFlow, trailingFinancials, trailingCashFlow, spySummary, recs] =
    await Promise.all([
      getQuoteSummary(symbol),
      getFundamentals(symbol, "annual", "financials", period1),
      getFundamentals(symbol, "annual", "cash-flow", period1),
      getFundamentals(symbol, "trailing", "financials", period1),
      getFundamentals(symbol, "trailing", "cash-flow", period1),
      getQuoteSummary("SPY", ["summaryDetail", "price"]),
      getRecommendations(symbol),
    ]);

  const recommendedPeerSymbols = normalizePeerSymbols(recs.slice(0, 5), symbol);
  const manualPeerSymbols = normalizePeerSymbols(manualPeerInput, symbol);
  const peerSource: PeerSource = manualPeerSymbols.length ? "manual" : "recommended";
  const peerSymbols = peerSource === "manual" ? manualPeerSymbols : recommendedPeerSymbols;
  const peers = await getPeerSnapshots(peerSymbols);
  const historicalValuations = await getHistoricalValuations(symbol, annualFinancials, annualCashFlow);

  const data = buildAnalysis({
    symbol,
    quoteSummary,
    annualFinancials,
    annualCashFlow,
    trailingFinancials,
    trailingCashFlow,
    historicalValuations,
    spySummary,
    peers,
    peerSource,
  });

  return {
    ...data,
    peerSymbols,
    recommendedPeerSymbols,
    peerSource,
  };
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(".", "-").slice(0, 16);
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

async function getQuoteSummary(symbol: string, modules?: string[]) {
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

  return (await yahooFinance.quoteSummary(
    symbol,
    {
      formatted: false,
      modules: selectedModules as never,
    },
    { validateResult: false },
  )) as AnyRecord;
}

async function getFundamentals(symbol: string, type: "annual" | "trailing", module: "financials" | "cash-flow", period1: string) {
  try {
    const rows = (await yahooFinance.fundamentalsTimeSeries(
      symbol,
      {
        period1,
        type,
        module,
      },
      { validateResult: false },
    )) as StatementRow[];

    return sortRows(rows);
  } catch {
    return [];
  }
}

async function getRecommendations(symbol: string) {
  try {
    const result = (await yahooFinance.recommendationsBySymbol(symbol, {}, { validateResult: false })) as AnyRecord;
    const rows = Array.isArray(result.recommendedSymbols) ? result.recommendedSymbols : [];
    return rows
      .map((item) => (isRecord(item) && typeof item.symbol === "string" ? item.symbol : undefined))
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

async function getPeerSnapshots(symbols: string[]): Promise<PeerSnapshot[]> {
  const uniqueSymbols = Array.from(new Set(symbols)).slice(0, 8);
  const snapshots = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        const summary = await getQuoteSummary(symbol, [
          "price",
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
        ]);
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
          evToEbitda: num(keyStats.enterpriseToEbitda),
          profitMargin: firstNumber(financialData.profitMargins, keyStats.profitMargins),
        };
      } catch {
        return undefined;
      }
    }),
  );

  return snapshots.filter((snapshot): snapshot is PeerSnapshot => Boolean(snapshot));
}

async function getHistoricalValuations(symbol: string, financials: StatementRow[], cashFlow: StatementRow[]) {
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
    const chart = (await yahooFinance.chart(
      symbol,
      {
        period1: start.toISOString().slice(0, 10),
        interval: "1d",
      },
      { validateResult: false },
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
  trailingFinancials,
  trailingCashFlow,
  historicalValuations,
  spySummary,
  peers,
  peerSource,
}: {
  symbol: string;
  quoteSummary: AnyRecord;
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  historicalValuations: Array<{ date: Date; ps?: number; pe?: number; pfcf?: number }>;
  spySummary: AnyRecord;
  peers: PeerSnapshot[];
  peerSource: PeerSource;
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
  const latestTrailingFinancial = lastUsefulRow(trailingFinancials, ["totalRevenue", "operatingRevenue", "trailingTotalRevenue"]);
  const latestTrailingCashFlow = lastUsefulRow(trailingCashFlow, ["freeCashFlow", "trailingFreeCashFlow"]);

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
  const sbc = firstNumber(
    latestTrailingCashFlow?.stockBasedCompensation,
    latestAnnualCashFlow?.stockBasedCompensation,
  );

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
    evToEbitda: num(keyStats.enterpriseToEbitda),
    peg: num(keyStats.pegRatio),
    marketPE: num(spyDetail.trailingPE),
    currentPrice,
    marketCap,
    trailingRevenue,
    trailingNetIncome,
    trailingFcf,
    sbc,
  };

  const growth = {
    revenueCagr3y: cagrFromRows(annualFinancials, "totalRevenue", "operatingRevenue", "annualTotalRevenue"),
    netIncomeCagr3y: cagrFromRows(annualFinancials, "netIncome", "netIncomeCommonStockholders", "annualNetIncome"),
    fcfCagr3y: cagrFromRows(annualCashFlow, "freeCashFlow", "annualFreeCashFlow"),
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
    evToEbitda: median(peers.map((peer) => peer.evToEbitda)),
    profitMargin: median(peers.map((peer) => peer.profitMargin)),
  };

  const historicalMedians = {
    ps: median(historicalValuations.map((item) => item.ps)),
    pe: median(historicalValuations.map((item) => item.pe)),
    pfcf: median(historicalValuations.map((item) => item.pfcf)),
  };

  const indicators = [
    buildDoubleIndicator(growth),
    buildValuationIndicator(current, historicalMedians, peerMedians),
    buildGrowthIndicator(current, growth, peerMedians),
    buildMarginsIndicator(current, growth, marginTrend, peerMedians),
    buildPegIndicator(current, growth),
  ];

  const knownIndicators = indicators.filter((item) => item.tone !== "unknown");
  const score = knownIndicators.length ? Math.round(avg(knownIndicators.map((item) => item.score))) : 0;
  const tone = toneFromScore(score);
  const label = labelFromScore(score, tone);
  const dataNotes = buildDataNotes({
    annualFinancials,
    annualCashFlow,
    trailingFinancials,
    trailingCashFlow,
    peers,
    historicalValuations,
    peerSource,
  });

  return {
    symbol: String(price.symbol ?? quoteType.symbol ?? symbol),
    name: String(price.shortName ?? price.longName ?? symbol),
    exchange: stringOrUndefined(price.exchangeName ?? price.fullExchangeName),
    sector: stringOrUndefined(assetProfile.sector),
    industry: stringOrUndefined(assetProfile.industry),
    currency: stringOrUndefined(price.currency ?? financialData.financialCurrency ?? summaryDetail.currency),
    price: formatMoney(current.currentPrice, stringOrUndefined(price.currency)),
    marketCap: formatCompact(current.marketCap),
    asOf: new Date().toISOString(),
    score,
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
}): IndicatorResult {
  const values = [
    growth.revenueCagr3y,
    growth.netIncomeCagr3y,
    growth.fcfCagr3y,
    growth.forwardRevenueGrowth,
    growth.forwardEarningsGrowth,
  ].filter(isFiniteNumber);

  const cagrValues = [growth.revenueCagr3y, growth.netIncomeCagr3y, growth.fcfCagr3y].filter(isFiniteNumber);
  const doubleSignals = values.filter((value) => value >= DOUBLE_CAGR).length;
  const score = values.length
    ? clamp(Math.round(avg(values.map((value) => clamp((value / DOUBLE_CAGR) * 82, 0, 100))) + doubleSignals * 4), 0, 100)
    : 0;
  const tone = values.length ? toneFromScore(score) : "unknown";

  return {
    id: "double",
    title: "Подвоєння за 5 років",
    subtitle: "Виручка, прибуток, FCF",
    verdict:
      tone === "good"
        ? "Темпи вже близькі або вищі за рівень, потрібний для подвоєння."
        : tone === "watch"
          ? "Є окремі сильні темпи, але повної впевненості для подвоєння поки немає."
          : tone === "bad"
            ? "Поточні темпи нижчі за потрібні для подвоєння за 5 років."
            : "Недостатньо історії для оцінки подвоєння.",
    tone,
    score,
    evidence: compactEvidence([
      ["Потрібний CAGR", formatPercent(DOUBLE_CAGR)],
      ["Виручка CAGR 3р", formatPercent(growth.revenueCagr3y)],
      ["Прибуток CAGR 3р", formatPercent(growth.netIncomeCagr3y)],
      ["FCF CAGR 3р", formatPercent(growth.fcfCagr3y)],
      ["Прогноз EPS", formatPercent(growth.forwardEarningsGrowth)],
      cagrValues.length ? ["Сигналів подвоєння", `${doubleSignals}/${values.length}`] : undefined,
    ]),
  };
}

function buildValuationIndicator(
  current: {
    trailingPE?: number;
    forwardPE?: number;
    priceToSales?: number;
    pfcf?: number;
    evToEbitda?: number;
    marketPE?: number;
  },
  history: { ps?: number; pe?: number; pfcf?: number },
  peers: { trailingPE?: number; forwardPE?: number; ps?: number; evToEbitda?: number },
): IndicatorResult {
  const signals = [
    discountSignal(current.trailingPE, current.marketPE),
    discountSignal(current.trailingPE, peers.trailingPE),
    discountSignal(current.forwardPE, peers.forwardPE),
    discountSignal(current.priceToSales, history.ps),
    discountSignal(current.pfcf, history.pfcf),
    discountSignal(current.evToEbitda, peers.evToEbitda),
  ].filter(isFiniteNumber);
  const score = signals.length ? clamp(Math.round(avg(signals)), 0, 100) : 0;
  const tone = signals.length ? toneFromScore(score) : "unknown";

  return {
    id: "valuation",
    title: "Ціна проти ринку",
    subtitle: "Ринок, peers, історія",
    verdict:
      tone === "good"
        ? "Оцінка виглядає дешевшою за кількома доступними мультиплікаторами."
        : tone === "watch"
          ? "Мультиплікатори неоднорідні: частина дешевша, частина вже з премією."
          : tone === "bad"
            ? "Папір торгується з премією до доступних бенчмарків."
            : "Немає достатніх мультиплікаторів для порівняння ціни.",
    tone,
    score,
    evidence: compactEvidence([
      ["P/E", formatMultiple(current.trailingPE)],
      ["P/E SPY", formatMultiple(current.marketPE)],
      ["P/E peers", formatMultiple(peers.trailingPE)],
      ["P/S", formatMultiple(current.priceToSales)],
      ["P/S істор.", formatMultiple(history.ps)],
      ["P/FCF", formatMultiple(current.pfcf)],
      ["P/FCF істор.", formatMultiple(history.pfcf)],
    ]),
  };
}

function buildGrowthIndicator(
  current: {
    revenueGrowth?: number;
    earningsGrowth?: number;
  },
  growth: {
    revenueCagr3y?: number;
    fcfCagr3y?: number;
    forwardRevenueGrowth?: number;
  },
  peers: { revenueGrowth?: number; earningsGrowth?: number },
): IndicatorResult {
  const signals = [
    premiumSignal(current.revenueGrowth, peers.revenueGrowth),
    premiumSignal(current.earningsGrowth, peers.earningsGrowth),
    premiumSignal(growth.forwardRevenueGrowth, peers.revenueGrowth),
    thresholdSignal(growth.revenueCagr3y, 0.1, 0.16),
    thresholdSignal(growth.fcfCagr3y, 0.08, 0.15),
  ].filter(isFiniteNumber);
  const score = signals.length ? clamp(Math.round(avg(signals)), 0, 100) : 0;
  const tone = signals.length ? toneFromScore(score) : "unknown";

  return {
    id: "growth",
    title: "Ріст проти конкурентів",
    subtitle: "Виручка, прибуток, FCF",
    verdict:
      tone === "good"
        ? "Компанія росте швидше за peer-групу або має сильний власний тренд."
        : tone === "watch"
          ? "Ріст конкурентний, але не всюди кращий за групу порівняння."
          : tone === "bad"
            ? "Темпи росту слабші за доступну peer-групу."
            : "Немає достатніх даних для порівняння росту.",
    tone,
    score,
    evidence: compactEvidence([
      ["Виручка YoY", formatPercent(current.revenueGrowth)],
      ["Виручка peers", formatPercent(peers.revenueGrowth)],
      ["EPS YoY", formatPercent(current.earningsGrowth)],
      ["EPS peers", formatPercent(peers.earningsGrowth)],
      ["Виручка CAGR", formatPercent(growth.revenueCagr3y)],
      ["FCF CAGR", formatPercent(growth.fcfCagr3y)],
    ]),
  };
}

function buildMarginsIndicator(
  current: {
    grossMargin?: number;
    operatingMargin?: number;
    profitMargin?: number;
    returnOnEquity?: number;
    revenueGrowth?: number;
  },
  growth: { revenueCagr3y?: number },
  trend: {
    grossDelta?: number;
    operatingDelta?: number;
    netDelta?: number;
  },
  peers: { profitMargin?: number },
): IndicatorResult {
  const expansionSignals = [trend.grossDelta, trend.operatingDelta, trend.netDelta].filter(isFiniteNumber);
  const signals = [
    ...expansionSignals.map((delta) => thresholdSignal(delta, -0.01, 0.02)),
    thresholdSignal(current.revenueGrowth ?? growth.revenueCagr3y, 0, 0.12),
    premiumSignal(current.profitMargin, peers.profitMargin),
    thresholdSignal(current.returnOnEquity, 0.1, 0.25),
  ].filter(isFiniteNumber);
  const score = signals.length ? clamp(Math.round(avg(signals)), 0, 100) : 0;
  const tone = signals.length ? toneFromScore(score) : "unknown";

  return {
    id: "margins",
    title: "Маржа й перевага",
    subtitle: "Якість росту",
    verdict:
      tone === "good"
        ? "Ріст підтримується маржами та якісною прибутковістю."
        : tone === "watch"
          ? "Маржі здебільшого тримаються, але перевага не бездоганна."
          : tone === "bad"
            ? "Маржі або прибутковість слабшають на фоні росту."
            : "Недостатньо даних для оцінки маржинальності.",
    tone,
    score,
    evidence: compactEvidence([
      ["Gross margin", formatPercent(current.grossMargin)],
      ["Gross зміна 3р", formatPp(trend.grossDelta)],
      ["Operating margin", formatPercent(current.operatingMargin)],
      ["Operating зміна", formatPp(trend.operatingDelta)],
      ["Net margin", formatPercent(current.profitMargin)],
      ["ROE", formatPercent(current.returnOnEquity)],
    ]),
  };
}

function buildPegIndicator(
  current: {
    peg?: number;
    forwardPE?: number;
    trailingPE?: number;
    trailingRevenue?: number;
    trailingFcf?: number;
    sbc?: number;
  },
  growth: {
    forwardEarningsGrowth?: number;
    netIncomeCagr3y?: number;
  },
): IndicatorResult {
  const growthForPeg = firstNumber(growth.forwardEarningsGrowth, growth.netIncomeCagr3y);
  const basePeg = firstNumber(
    current.peg,
    growthForPeg && growthForPeg > 0 ? (current.forwardPE ?? current.trailingPE ?? 0) / (growthForPeg * 100) : undefined,
  );
  const sbcToRevenue = positiveRatio(current.sbc, current.trailingRevenue);
  const sbcToFcf = positiveRatio(current.sbc, current.trailingFcf);
  const adjustedFcf = subtractIfBoth(current.trailingFcf, current.sbc);
  const adjustment = current.trailingFcf && adjustedFcf && adjustedFcf > 0 ? current.trailingFcf / adjustedFcf : undefined;
  const adjustedPeg = basePeg && adjustment ? basePeg * adjustment : basePeg;

  const signals = [
    pegSignal(adjustedPeg),
    sbcToRevenue !== undefined ? thresholdSignal(-sbcToRevenue, -0.1, -0.03) : undefined,
    sbcToFcf !== undefined ? thresholdSignal(-sbcToFcf, -0.25, -0.08) : undefined,
  ].filter(isFiniteNumber);
  const score = signals.length ? clamp(Math.round(avg(signals)), 0, 100) : 0;
  const tone = signals.length ? toneFromScore(score) : "unknown";

  return {
    id: "peg",
    title: "PEG з SBC",
    subtitle: "PEG < 1 після компенсацій",
    verdict:
      tone === "good"
        ? "SBC не ламає картину: скоригований PEG нижче або близько 1."
        : tone === "watch"
          ? "PEG або SBC потребують уваги, але сигнал не критичний."
          : tone === "bad"
            ? "PEG з урахуванням SBC виглядає дорогим."
            : "Немає даних для PEG або SBC-корекції.",
    tone,
    score,
    evidence: compactEvidence([
      ["PEG Yahoo", formatMultiple(basePeg)],
      ["PEG з SBC", formatMultiple(adjustedPeg)],
      ["SBC / виручка", formatPercent(sbcToRevenue)],
      ["SBC / FCF", formatPercent(sbcToFcf)],
      ["EPS growth", formatPercent(growthForPeg)],
    ]),
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

function trendGrowth(earningsTrend: AnyRecord, key: "revenueEstimate" | "earningsEstimate") {
  const trend = Array.isArray(earningsTrend.trend) ? earningsTrend.trend : [];
  const annualTrend = trend.find((row) => isRecord(row) && row.period === "+1y") ?? trend.find((row) => isRecord(row) && row.period === "0y");
  if (!isRecord(annualTrend)) return undefined;
  const estimate = asRecord(annualTrend[key]);
  return firstNumber(estimate.growth, annualTrend.growth);
}

function discountSignal(value?: number, benchmark?: number) {
  if (!isFiniteNumber(value) || !isFiniteNumber(benchmark) || value <= 0 || benchmark <= 0) {
    return undefined;
  }
  const discount = (benchmark - value) / benchmark;
  if (discount >= 0.2) return 100;
  if (discount >= 0.05) return 76;
  if (discount >= -0.1) return 54;
  if (discount >= -0.25) return 34;
  return 12;
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

function toneFromScore(score: number): MetricTone {
  if (score >= 70) return "good";
  if (score >= 45) return "watch";
  return "bad";
}

function labelFromScore(score: number, tone: MetricTone) {
  if (tone === "good") return `Сильний профіль: ${score}/100`;
  if (tone === "watch") return `Змішаний профіль: ${score}/100`;
  if (tone === "bad") return `Слабкий профіль: ${score}/100`;
  return "Даних замало";
}

function buildDataNotes({
  annualFinancials,
  annualCashFlow,
  trailingFinancials,
  trailingCashFlow,
  peers,
  historicalValuations,
  peerSource,
}: {
  annualFinancials: StatementRow[];
  annualCashFlow: StatementRow[];
  trailingFinancials: StatementRow[];
  trailingCashFlow: StatementRow[];
  peers: PeerSnapshot[];
  historicalValuations: Array<{ date: Date }>;
  peerSource: PeerSource;
}) {
  const notes =
    peerSource === "manual"
      ? ["Дані: Yahoo Finance; peer-група: вручну обрані конкуренти, медіана по доступних показниках."]
      : ["Дані: Yahoo Finance; peer-група: базові рекомендації Yahoo. Для якісного порівняння краще обрати конкурентів вручну."];
  if (annualFinancials.length < 3) notes.push("Історія фінзвітності коротка, CAGR може бути нестабільним.");
  if (!annualCashFlow.length || !trailingCashFlow.length) notes.push("Cash flow або SBC доступні не для всіх емітентів.");
  if (!trailingFinancials.length) notes.push("TTM-фінанси відсутні, частина метрик взята з останнього річного звіту.");
  if (!peers.length) notes.push("Peer-порівняння недоступне для цього тікера.");
  if (historicalValuations.length < 2) notes.push("Історичні valuation-мультиплікатори не вдалося побудувати.");
  notes.push("Не є інвестиційною рекомендацією.");
  return notes;
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

function compactEvidence(items: Array<[string, string] | undefined>): EvidenceItem[] {
  return items
    .filter((item): item is [string, string] => Boolean(item))
    .filter(([, value]) => value !== "н/д")
    .slice(0, 7)
    .map(([label, value]) => ({ label, value }));
}

function median(values: Array<number | undefined>) {
  const clean = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function avg(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function formatPercent(value?: number) {
  if (!isFiniteNumber(value)) return "н/д";
  return new Intl.NumberFormat("uk-UA", {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: Math.abs(value) < 0.1 ? 1 : 0,
  }).format(value);
}

function formatPp(value?: number) {
  if (!isFiniteNumber(value)) return "н/д";
  const pp = value * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(pp)} п.п.`;
}

function formatMultiple(value?: number) {
  if (!isFiniteNumber(value) || value <= 0) return "н/д";
  return `${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)}x`;
}

function formatCompact(value?: number) {
  if (!isFiniteNumber(value)) return undefined;
  return new Intl.NumberFormat("uk-UA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMoney(value?: number, currency = "USD") {
  if (!isFiniteNumber(value)) return undefined;
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      maximumFractionDigits: value > 100 ? 0 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: 2,
    }).format(value);
  }
}
