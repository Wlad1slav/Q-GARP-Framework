import YahooFinance from "yahoo-finance2";
import {
  supplementalMetricIds,
  type SupplementalMetricChartPoint,
  type SupplementalMetricId,
  type SupplementalMetricResult,
  type SupplementalMetricsResult,
} from "./analysis-types";
import { analysisCopy, defaultLanguage, localeForLanguage, normalizeLanguage, type Language } from "./i18n";
import type { QueuePriority } from "./priority-task-queue";
import { normalizeTicker } from "./ticker";
import { runCachedYahooRequest } from "./yahoo-request-queue";

type AnyRecord = Record<string, unknown>;

type StatementRow = AnyRecord & {
  date?: string | number | Date;
};

type PriceHistoryPoint = {
  date: Date;
  close: number;
};

const TWO_HUNDRED_DAY_WINDOW = 200;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export async function getSupplementalMetrics(
  inputTicker: string,
  selectedLanguage: Language = defaultLanguage,
  priority: QueuePriority = "single",
  requestedMetricIds: readonly SupplementalMetricId[] = supplementalMetricIds,
): Promise<SupplementalMetricsResult> {
  const language = normalizeLanguage(selectedLanguage);
  const symbol = normalizeTicker(inputTicker);
  if (!symbol) {
    throw new Error(analysisCopy[language].errors.invalidTicker);
  }

  const selectedMetricIds = normalizeSupplementalMetricIds(requestedMetricIds);
  const needsCashFlow = selectedMetricIds.some(
    (id) => id === "totalShareholderYield" || id === "fcfYield" || id === "payoutRatio",
  );
  const needsMomentumHistory = selectedMetricIds.includes("momentum");
  const quoteModules = ["price", "summaryDetail", "financialData"];
  if (selectedMetricIds.includes("payoutRatio")) {
    quoteModules.push("defaultKeyStatistics");
  }
  const period1 = yearStart(-2);
  const [quoteSummary, trailingCashFlow, annualCashFlow, priceHistory] = await Promise.all([
    getQuoteSummary(symbol, quoteModules, priority),
    needsCashFlow ? getCashFlow(symbol, "trailing", period1, priority) : Promise.resolve([]),
    needsCashFlow ? getCashFlow(symbol, "annual", period1, priority) : Promise.resolve([]),
    needsMomentumHistory ? getPriceHistory(symbol, yearsAgo(2), priority) : Promise.resolve([]),
  ]);

  const price = asRecord(quoteSummary.price);
  const financialData = asRecord(quoteSummary.financialData);
  const summaryDetail = asRecord(quoteSummary.summaryDetail);
  const keyStats = asRecord(quoteSummary.defaultKeyStatistics);
  const latestTrailingCashFlow = lastUsefulRow(trailingCashFlow, ["repurchaseOfCapitalStock", "freeCashFlow", "trailingFreeCashFlow"]);
  const latestAnnualCashFlow = lastUsefulRow(annualCashFlow, ["repurchaseOfCapitalStock", "freeCashFlow", "annualFreeCashFlow"]);

  const currency = stringOrUndefined(price.currency ?? financialData.financialCurrency ?? summaryDetail.currency);
  const currentPrice = firstNumber(financialData.currentPrice, price.regularMarketPrice);
  const marketCap = firstNumber(summaryDetail.marketCap, price.marketCap);
  const dividendYield = normalizeYield(firstNumber(summaryDetail.dividendYield));
  const reportedPayoutRatio = firstNumber(summaryDetail.payoutRatio, keyStats.payoutRatio);
  const dividendRate = firstNumber(summaryDetail.dividendRate, summaryDetail.trailingAnnualDividendRate, keyStats.lastDividendValue);
  const sharesOutstanding = firstNumber(price.sharesOutstanding, keyStats.sharesOutstanding, summaryDetail.sharesOutstanding);
  const repurchaseOfCapitalStock = firstNumber(
    latestTrailingCashFlow?.repurchaseOfCapitalStock,
    latestTrailingCashFlow?.commonStockPayments,
    latestTrailingCashFlow?.netCommonStockIssuance,
    latestAnnualCashFlow?.repurchaseOfCapitalStock,
    latestAnnualCashFlow?.commonStockPayments,
    latestAnnualCashFlow?.netCommonStockIssuance,
  );
  const buybackYield = marketCap ? ratio(negate(repurchaseOfCapitalStock), marketCap) : undefined;
  const freeCashFlow = firstNumber(
    financialData.freeCashflow,
    latestTrailingCashFlow?.freeCashFlow,
    latestTrailingCashFlow?.trailingFreeCashFlow,
    latestAnnualCashFlow?.freeCashFlow,
    latestAnnualCashFlow?.annualFreeCashFlow,
  );
  const annualDividendCash = multiplyIfFinite(dividendRate, sharesOutstanding);
  const fcfPayoutRatio =
    isFiniteNumber(annualDividendCash) && annualDividendCash >= 0 && isFiniteNumber(freeCashFlow) && freeCashFlow > 0
      ? annualDividendCash / freeCashFlow
      : undefined;
  const payoutRatio = firstNumber(fcfPayoutRatio, reportedPayoutRatio);
  const totalDebt = firstNumber(financialData.totalDebt);
  const totalCash = firstNumber(financialData.totalCash);
  const ebitda = firstNumber(financialData.ebitda);
  const netDebt = subtractIfBoth(totalDebt, totalCash);
  const netDebtToEbitda = isFiniteNumber(ebitda) && ebitda > 0 ? ratio(netDebt, ebitda) : undefined;
  const targetMedianPrice = firstNumber(financialData.targetMedianPrice);
  const fiftyTwoWeekLow = firstNumber(summaryDetail.fiftyTwoWeekLow);
  const fiftyTwoWeekHigh = firstNumber(summaryDetail.fiftyTwoWeekHigh);
  const twoHundredDayAverage = firstNumber(summaryDetail.twoHundredDayAverage, financialData.twoHundredDayAverage);

  const totalShareholderYield = addIfAny(dividendYield, buybackYield);
  const fcfYield = ratio(freeCashFlow, marketCap);
  const impliedUpside =
    currentPrice && currentPrice > 0 && isFiniteNumber(targetMedianPrice)
      ? (targetMedianPrice - currentPrice) / currentPrice
      : undefined;
  const fiftyTwoWeekRangePosition =
    isFiniteNumber(currentPrice) &&
    isFiniteNumber(fiftyTwoWeekLow) &&
    isFiniteNumber(fiftyTwoWeekHigh) &&
    fiftyTwoWeekHigh > fiftyTwoWeekLow
      ? (currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)
      : undefined;
  const momentum =
    isFiniteNumber(currentPrice) && isFiniteNumber(twoHundredDayAverage) && twoHundredDayAverage > 0
      ? (currentPrice - twoHundredDayAverage) / twoHundredDayAverage
      : undefined;
  const copy = supplementalCopy(language);
  const momentumChart = buildMomentumChart(priceHistory, twoHundredDayAverage, currency, copy);
  const metricsById = {
    totalShareholderYield: {
      id: "totalShareholderYield",
      value: formatPercent(totalShareholderYield, language),
      detail: detailParts(
        [
          [copy.dividend, formatPercent(dividendYield, language)],
          [copy.buyback, formatPercent(buybackYield, language)],
        ],
        language,
      ),
    },
    fcfYield: {
      id: "fcfYield",
      value: formatPercent(fcfYield, language),
      detail: formatCompactDetail("FCF", freeCashFlow, language),
    },
    payoutRatio: {
      id: "payoutRatio",
      value: formatPercent(payoutRatio, language),
      detail: detailParts(
        [
          [copy.reportedPayout, formatPercent(reportedPayoutRatio, language)],
          [copy.fcfPayout, formatPercent(fcfPayoutRatio, language)],
          payoutRiskFlag(reportedPayoutRatio, fcfPayoutRatio, dividendRate, freeCashFlow, copy),
        ],
        language,
        "; ",
      ),
    },
    netDebtToEbitda: {
      id: "netDebtToEbitda",
      value: formatMultipleAllowingZero(netDebtToEbitda, language),
      detail: detailParts(
        [
          [copy.netDebt, formatCompactValue(netDebt, language)],
          [copy.ebitda, formatCompactValue(ebitda, language)],
          isFiniteNumber(netDebtToEbitda) && netDebtToEbitda > 3 ? [copy.flag, copy.leverageWatchZone] : undefined,
        ],
        language,
        "; ",
      ),
    },
    impliedUpside: {
      id: "impliedUpside",
      value: formatPercent(impliedUpside, language),
      detail: targetMedianPrice ? `${copy.target} ${formatMoney(targetMedianPrice, currency, language)}` : undefined,
    },
    fiftyTwoWeekRangePosition: {
      id: "fiftyTwoWeekRangePosition",
      value: formatPercent(fiftyTwoWeekRangePosition, language),
      detail:
        isFiniteNumber(fiftyTwoWeekLow) && isFiniteNumber(fiftyTwoWeekHigh)
          ? `${formatMoney(fiftyTwoWeekLow, currency, language)} - ${formatMoney(fiftyTwoWeekHigh, currency, language)}`
          : undefined,
    },
    momentum: {
      id: "momentum",
      value: formatSignedPercent(momentum, language),
      detail: detailParts(
        [
          [copy.price, formatMoney(currentPrice, currency, language)],
          [copy.twoHundredDayAverage, formatMoney(twoHundredDayAverage, currency, language)],
        ],
        language,
        "; ",
      ),
      chart: momentumChart,
    },
  } satisfies Record<SupplementalMetricId, SupplementalMetricResult>;

  return {
    symbol: String(price.symbol ?? symbol),
    asOf: new Date().toISOString(),
    metrics: selectedMetricIds.map((id) => metricsById[id]),
    dataNotes: [copy.sourceNote],
  };
}

export function isSupplementalMetricId(value: string): value is SupplementalMetricId {
  return supplementalMetricIds.includes(value as SupplementalMetricId);
}

function normalizeSupplementalMetricIds(values: readonly SupplementalMetricId[]) {
  return Array.from(new Set(values)).filter(isSupplementalMetricId);
}

async function getQuoteSummary(symbol: string, modules: string[], priority: QueuePriority) {
  return (await runCachedYahooRequest(`supplemental:quoteSummary:${symbol}:${modules.join(",")}`, priority, () =>
    yahooFinance.quoteSummary(
      symbol,
      {
        formatted: false,
        modules: modules as never,
      },
      { validateResult: false },
    ),
  )) as AnyRecord;
}

async function getCashFlow(symbol: string, type: "annual" | "trailing", period1: string, priority: QueuePriority) {
  try {
    const rows = (await runCachedYahooRequest(`supplemental:cash-flow:${symbol}:${type}:${period1}`, priority, () =>
      yahooFinance.fundamentalsTimeSeries(
        symbol,
        {
          period1,
          type,
          module: "cash-flow",
        },
        { validateResult: false },
      ),
    )) as StatementRow[];

    return sortRows(rows);
  } catch {
    return [];
  }
}

async function getPriceHistory(symbol: string, period1: string, priority: QueuePriority) {
  try {
    const chart = (await runCachedYahooRequest(`supplemental:chart:${symbol}:${period1}:1d`, priority, () =>
      yahooFinance.chart(
        symbol,
        {
          period1,
          interval: "1d",
        },
        { validateResult: false },
      ),
    )) as AnyRecord;

    return chartToPrices(chart);
  } catch {
    return [];
  }
}

function yearStart(offset: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + offset, 0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function yearsAgo(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function buildMomentumChart(
  prices: PriceHistoryPoint[],
  currentAverage: number | undefined,
  currency: string | undefined,
  copy: ReturnType<typeof supplementalCopy>,
): SupplementalMetricResult["chart"] {
  const sortedPrices = [...prices].sort((left, right) => left.date.getTime() - right.date.getTime());
  if (sortedPrices.length < 2) return undefined;

  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  oneYearAgo.setUTCHours(0, 0, 0, 0);

  const points = withTwoHundredDayAverage(sortedPrices)
    .filter((point) => point.date.getTime() >= oneYearAgo.getTime())
    .map((point): SupplementalMetricChartPoint => {
      const average = isFiniteNumber(point.average)
        ? point.average
        : isFiniteNumber(currentAverage)
          ? currentAverage
          : undefined;

      return {
        date: point.date.toISOString().slice(0, 10),
        price: roundChartNumber(point.close),
        average: isFiniteNumber(average) ? roundChartNumber(average) : undefined,
      };
    })
    .filter((point) => isFiniteNumber(point.price));

  if (points.length < 2) return undefined;

  return {
    currency,
    priceLabel: copy.price,
    averageLabel: copy.twoHundredDayAverage,
    points,
  };
}

function withTwoHundredDayAverage(points: PriceHistoryPoint[]) {
  const window: number[] = [];
  let sum = 0;

  return points.map((point) => {
    window.push(point.close);
    sum += point.close;

    if (window.length > TWO_HUNDRED_DAY_WINDOW) {
      sum -= window.shift() ?? 0;
    }

    return {
      ...point,
      average: window.length === TWO_HUNDRED_DAY_WINDOW ? sum / TWO_HUNDRED_DAY_WINDOW : undefined,
    };
  });
}

function chartToPrices(chart: AnyRecord): PriceHistoryPoint[] {
  if (Array.isArray(chart.quotes)) {
    return chart.quotes
      .map((quote) => {
        const row = asRecord(quote);
        const date = dateValue(row.date);
        const close = firstNumber(row.close, row.adjclose);
        return date && isFiniteNumber(close) && close > 0 ? { date, close } : undefined;
      })
      .filter((item): item is PriceHistoryPoint => Boolean(item));
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
      return date && isFiniteNumber(close) && close > 0 ? { date, close } : undefined;
    })
    .filter((item): item is PriceHistoryPoint => Boolean(item));
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

function detailParts(items: Array<[string, string] | undefined>, language: Language, separator = " + ") {
  const emptyValue = analysisCopy[language].notAvailable;
  const parts = items
    .filter((item): item is [string, string] => Boolean(item))
    .filter(([, value]) => value !== emptyValue)
    .map(([label, value]) => `${label} ${value}`);
  return parts.length ? parts.join(separator) : undefined;
}

function formatCompactDetail(label: string, value: number | undefined, language: Language) {
  const formatted = formatCompact(value, language);
  return formatted ? `${label} ${formatted}` : undefined;
}

function supplementalCopy(language: Language) {
  if (language === "en") {
    return {
      dividend: "Dividend",
      buyback: "buyback",
      price: "Price",
      target: "Target",
      reportedPayout: "Reported",
      fcfPayout: "FCF-based",
      netDebt: "Net debt",
      ebitda: "EBITDA",
      flag: "Flag",
      possibleDividendCut: "possible cut",
      dividendNotCoveredByFcf: "FCF does not cover dividend",
      leverageWatchZone: ">3x watch zone for asset-light businesses",
      twoHundredDayAverage: "200D avg",
      sourceNote: "Supplemental metrics: Yahoo Finance quoteSummary, price history, and cash-flow data.",
    };
  }

  return {
    dividend: "Дивіденди",
    buyback: "викуп",
    price: "Ціна",
    target: "Таргет",
    reportedPayout: "Reported",
    fcfPayout: "На базі FCF",
    netDebt: "Net debt",
    ebitda: "EBITDA",
    flag: "Прапорець",
    possibleDividendCut: "можливе скорочення",
    dividendNotCoveredByFcf: "FCF не покриває дивіденд",
    leverageWatchZone: ">3x жовта зона для asset-light бізнесу",
    twoHundredDayAverage: "200D середня",
    sourceNote: "Додаткові метрики: Yahoo Finance quoteSummary, історія цін та cash-flow дані.",
  };
}

function payoutRiskFlag(
  reportedPayoutRatio: number | undefined,
  fcfPayoutRatio: number | undefined,
  dividendRate: number | undefined,
  freeCashFlow: number | undefined,
  copy: ReturnType<typeof supplementalCopy>,
): [string, string] | undefined {
  if (isFiniteNumber(fcfPayoutRatio) && fcfPayoutRatio > 0.9) return [copy.flag, copy.possibleDividendCut];
  if (isFiniteNumber(reportedPayoutRatio) && reportedPayoutRatio > 0.9) return [copy.flag, copy.possibleDividendCut];
  if (isFiniteNumber(dividendRate) && dividendRate > 0 && isFiniteNumber(freeCashFlow) && freeCashFlow <= 0) {
    return [copy.flag, copy.dividendNotCoveredByFcf];
  }
  return undefined;
}

function ratio(a?: number, b?: number) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b) || b === 0) return undefined;
  return a / b;
}

function multiplyIfFinite(a?: number, b?: number) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return undefined;
  return a * b;
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

function normalizeYield(value: number | undefined) {
  if (!isFiniteNumber(value)) return undefined;
  return Math.abs(value) > 1 ? value / 100 : value;
}

function roundChartNumber(value: number) {
  return Math.round(value * 10000) / 10000;
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

function formatSignedPercent(value: number | undefined, language: Language) {
  const formatted = formatPercent(value, language);
  if (!isFiniteNumber(value) || value <= 0 || formatted === analysisCopy[language].notAvailable) return formatted;
  return `+${formatted}`;
}

function formatCompact(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return undefined;
  return new Intl.NumberFormat(localeForLanguage(language), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactValue(value: number | undefined, language: Language) {
  return formatCompact(value, language) ?? analysisCopy[language].notAvailable;
}

function formatMultipleAllowingZero(value: number | undefined, language: Language) {
  if (!isFiniteNumber(value)) return analysisCopy[language].notAvailable;
  return `${new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 1,
    minimumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value)}x`;
}

function formatMoney(value: number | undefined, currency = "USD", language: Language) {
  if (!isFiniteNumber(value)) return analysisCopy[language].notAvailable;
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
