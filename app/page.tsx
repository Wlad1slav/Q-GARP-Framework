"use client";

import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Loader2,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_ANALYSIS_SETTINGS,
  parseSectorWeightsFlag,
  readAnalysisSettings,
  sectorWeightsSearchParam,
  SECTOR_WEIGHTS_QUERY_PARAM,
  writeAnalysisSettings,
  type SupplementalMetricSettings,
} from "@/lib/analysis-settings";
import type {
  AnalysisResult,
  IndicatorResult,
  MetricTone,
  SupplementalMetricId,
  SupplementalMetricResult,
  SupplementalMetricsResult,
} from "@/lib/analysis-types";
import { supplementalMetricIds } from "@/lib/analysis-types";
import { companyLogoUrl } from "@/lib/company-logo";
import {
  defaultLanguage,
  LANGUAGE_STORAGE_KEY,
  localeForLanguage,
  normalizeLanguage,
  uiCopy,
  type Language,
} from "@/lib/i18n";
import {
  APP_ANALYSIS_REQUEST_EVENT,
  APP_ANALYSIS_SETTINGS_CHANGE_EVENT,
  APP_ANALYSIS_STATUS_EVENT,
  APP_LANGUAGE_CHANGE_EVENT,
  type AppAnalysisRequestDetail,
  type AppAnalysisSettingsChangeDetail,
  type AppAnalysisStatusDetail,
  type AppLanguageChangeDetail,
} from "@/lib/app-events";
import { readBrowserStorageItem, writeBrowserStorageItem } from "@/lib/browser-storage";
import { JoinedTextWithActualPeersLinks, TextWithActualPeersLink } from "@/lib/actual-peers-link";
import { termDefinitions, termForLabel, type TermKey } from "@/lib/term-definitions";
import { normalizeTicker } from "@/lib/ticker";
import Image from "next/image";

const metricIcons = {
  double: TrendingUp,
  valuation: BadgeDollarSign,
  growth: BarChart3,
  margins: ShieldCheck,
  peg: Calculator,
} satisfies Record<IndicatorResult["id"], typeof TrendingUp>;

const toneIcons = {
  good: CheckCircle2,
  watch: CircleAlert,
  bad: XCircle,
  unknown: AlertTriangle,
} satisfies Record<MetricTone, typeof CheckCircle2>;

const supplementalMetricIcons = {
  totalShareholderYield: BadgeDollarSign,
  fcfYield: Calculator,
  payoutRatio: ShieldCheck,
  netDebtToEbitda: Calculator,
  impliedUpside: TrendingUp,
  fiftyTwoWeekRangePosition: BarChart3,
  momentum: TrendingUp,
} satisfies Record<SupplementalMetricId, typeof TrendingUp>;

const ANALYSIS_CACHE_STORAGE_KEY = "invest-rate.analysis-results.v3";
const SUPPLEMENTAL_CACHE_STORAGE_KEY = "invest-rate.supplemental-metrics.v1";
const ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_ANALYSES = 60;
const MAX_STORED_SUPPLEMENTAL_RESULTS = 80;
const supplementalMetricsCopy = {
  uk: {
    ariaLabel: "Додаткові метрики стоку",
    loading: "Завантаження",
    errorFallback: "Не вдалося завантажити додаткові метрики.",
    metrics: {
      totalShareholderYield: "Total Shareholder Yield",
      fcfYield: "FCF yield",
      payoutRatio: "Payout ratio",
      netDebtToEbitda: "Net debt / EBITDA",
      impliedUpside: "Implied upside",
      fiftyTwoWeekRangePosition: "Позиція в 52-тижневому діапазоні",
      momentum: "Momentum",
    },
  },
  en: {
    ariaLabel: "Supplemental stock metrics",
    loading: "Loading",
    errorFallback: "Could not load supplemental metrics.",
    metrics: {
      totalShareholderYield: "Total Shareholder Yield",
      fcfYield: "FCF yield",
      payoutRatio: "Payout ratio",
      netDebtToEbitda: "Net debt / EBITDA",
      impliedUpside: "Implied upside",
      fiftyTwoWeekRangePosition: "52-week range position",
      momentum: "Momentum",
    },
  },
} satisfies Record<
  Language,
  {
    ariaLabel: string;
    loading: string;
    errorFallback: string;
    metrics: Record<SupplementalMetricId, string>;
  }
>;

type CachedAnalysisEntry = {
  result: AnalysisResult;
  expiresAt: number;
};

type CachedSupplementalEntry = {
  dataNotes: string[];
  result: SupplementalMetricResult;
  expiresAt: number;
};

export default function Home() {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [ticker, setTicker] = useState("");
  const [lastTicker, setLastTicker] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [useSectorWeights, setUseSectorWeights] = useState(DEFAULT_ANALYSIS_SETTINGS.useSectorWeights);
  const [supplementalMetricSettings, setSupplementalMetricSettings] = useState(
    DEFAULT_ANALYSIS_SETTINGS.supplementalMetrics,
  );
  const [supplementalMetrics, setSupplementalMetrics] = useState<Partial<Record<SupplementalMetricId, SupplementalMetricResult>>>({});
  const [supplementalLoading, setSupplementalLoading] = useState<Partial<Record<SupplementalMetricId, boolean>>>({});
  const [supplementalErrors, setSupplementalErrors] = useState<Partial<Record<SupplementalMetricId, string>>>({});
  const [supplementalNotes, setSupplementalNotes] = useState<Partial<Record<SupplementalMetricId, string[]>>>({});
  const didReadInitialUrl = useRef(false);
  const supplementalRequestIds = useRef(
    Object.fromEntries(supplementalMetricIds.map((id) => [id, 0])) as Record<SupplementalMetricId, number>,
  );
  const t = uiCopy[language];
  const enabledSupplementalMetricIds = supplementalMetricIds.filter((id) => supplementalMetricSettings[id]);
  const actualPeersSourceUrl = analysis?.actualPeersSourceUrl;

  const asOf = analysis?.asOf
    ? new Intl.DateTimeFormat(localeForLanguage(language), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(analysis.asOf))
    : "";

  const clearSupplementalMetrics = useCallback((metricIds: readonly SupplementalMetricId[] = supplementalMetricIds) => {
    for (const id of metricIds) {
      supplementalRequestIds.current[id] += 1;
    }

    setSupplementalMetrics((current) => omitSupplementalKeys(current, metricIds));
    setSupplementalLoading((current) => omitSupplementalKeys(current, metricIds));
    setSupplementalErrors((current) => omitSupplementalKeys(current, metricIds));
    setSupplementalNotes((current) => omitSupplementalKeys(current, metricIds));
  }, []);

  const loadSupplementalMetric = useCallback(
    async (metricId: SupplementalMetricId, nextTicker: string, requestLanguage = language) => {
      const cleanTicker = nextTicker.trim();
      if (!cleanTicker) {
        clearSupplementalMetrics([metricId]);
        return;
      }

      const requestId = supplementalRequestIds.current[metricId] + 1;
      supplementalRequestIds.current[metricId] = requestId;
      const requestCopy = supplementalMetricsCopy[requestLanguage];
      const cacheKey = supplementalCacheKey(cleanTicker, requestLanguage, metricId);
      const cachedEntry = readCachedSupplementalMetric(cacheKey);

      if (cachedEntry) {
        if (requestId !== supplementalRequestIds.current[metricId]) return;
        setSupplementalMetrics((current) => ({ ...current, [metricId]: cachedEntry.result }));
        setSupplementalNotes((current) => ({ ...current, [metricId]: cachedEntry.dataNotes }));
        setSupplementalErrors((current) => omitSupplementalKeys(current, [metricId]));
        setSupplementalLoading((current) => omitSupplementalKeys(current, [metricId]));
        return;
      }

      setSupplementalLoading((current) => ({ ...current, [metricId]: true }));
      setSupplementalErrors((current) => omitSupplementalKeys(current, [metricId]));
      setSupplementalMetrics((current) => omitSupplementalKeys(current, [metricId]));
      setSupplementalNotes((current) => omitSupplementalKeys(current, [metricId]));

      try {
        const params = new URLSearchParams({
          ticker: cleanTicker,
          lang: requestLanguage,
          metric: metricId,
        });
        const response = await fetch(`/api/analyze/supplemental?${params.toString()}`);
        const payload = (await response.json()) as SupplementalMetricsResult & { message?: string };

        if (!response.ok) {
          throw new Error(payload.message ?? requestCopy.errorFallback);
        }

        const metric = payload.metrics.find((item) => item.id === metricId);
        if (!metric) {
          throw new Error(requestCopy.errorFallback);
        }

        if (requestId !== supplementalRequestIds.current[metricId]) return;
        writeCachedSupplementalMetric(cacheKey, metric, payload.dataNotes);
        setSupplementalMetrics((current) => ({ ...current, [metricId]: metric }));
        setSupplementalNotes((current) => ({ ...current, [metricId]: payload.dataNotes }));
        setSupplementalErrors((current) => omitSupplementalKeys(current, [metricId]));
      } catch (caught) {
        if (requestId !== supplementalRequestIds.current[metricId]) return;
        setSupplementalMetrics((current) => omitSupplementalKeys(current, [metricId]));
        setSupplementalNotes((current) => omitSupplementalKeys(current, [metricId]));
        setSupplementalErrors((current) => ({
          ...current,
          [metricId]: caught instanceof Error ? caught.message : requestCopy.errorFallback,
        }));
      } finally {
        if (requestId === supplementalRequestIds.current[metricId]) {
          setSupplementalLoading((current) => omitSupplementalKeys(current, [metricId]));
        }
      }
    },
    [clearSupplementalMetrics, language],
  );

  const loadEnabledSupplementalMetrics = useCallback(
    (nextTicker: string, requestLanguage = language, requestSettings = supplementalMetricSettings) => {
      const metricIds = enabledSupplementalMetricsFromSettings(requestSettings);
      clearSupplementalMetrics();

      for (const metricId of metricIds) {
        void loadSupplementalMetric(metricId, nextTicker, requestLanguage);
      }
    },
    [clearSupplementalMetrics, language, loadSupplementalMetric, supplementalMetricSettings],
  );

  const loadAnalysis = useCallback(
    async (
      nextTicker: string,
      peerOverride?: string[] | null,
      requestLanguage = language,
      requestUseSectorWeights = useSectorWeights,
      requestSupplementalMetricSettings = supplementalMetricSettings,
    ) => {
      const cleanTicker = nextTicker.trim();
      if (!cleanTicker) return;
      const requestCopy = uiCopy[requestLanguage];
      const peers = peerOverride === undefined ? readSavedPeerGroup(cleanTicker) : (peerOverride ?? []);
      const params = new URLSearchParams({
        ticker: cleanTicker,
        lang: requestLanguage,
        [SECTOR_WEIGHTS_QUERY_PARAM]: sectorWeightsSearchParam(requestUseSectorWeights),
      });
      const cacheKey = analysisCacheKey(cleanTicker, peers, requestLanguage, requestUseSectorWeights);
      const cachedAnalysis = readCachedAnalysis(cacheKey);

      if (cachedAnalysis) {
        setAnalysis(cachedAnalysis);
        setPeerInput(cachedAnalysis.peerSymbols?.join(", ") ?? "");
        setPromptCopied(false);
        setLastTicker(normalizeTicker(cleanTicker));
        setError("");
        loadEnabledSupplementalMetrics(cleanTicker, requestLanguage, requestSupplementalMetricSettings);
        return;
      }

      if (peers.length) {
        params.set("peers", peers.join(","));
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/analyze?${params.toString()}`);
        const payload = (await response.json()) as AnalysisResult & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message ?? requestCopy.errors.loadData);
        }
        writeCachedAnalysis(cacheKey, payload);
        setAnalysis(payload);
        setPeerInput(payload.peerSymbols?.join(", ") ?? "");
        setPromptCopied(false);
        setLastTicker(cleanTicker.toUpperCase());
        loadEnabledSupplementalMetrics(cleanTicker, requestLanguage, requestSupplementalMetricSettings);
      } catch (caught) {
        setAnalysis(null);
        setError(caught instanceof Error ? caught.message : requestCopy.errors.loadData);
        clearSupplementalMetrics();
      } finally {
        setLoading(false);
      }
    },
    [
      clearSupplementalMetrics,
      language,
      loadEnabledSupplementalMetrics,
      supplementalMetricSettings,
      useSectorWeights,
    ],
  );

  useEffect(() => {
    if (didReadInitialUrl.current) return;
    didReadInitialUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const storedSettings = readAnalysisSettings(APP_SETTINGS_STORAGE_KEY);
    const initialLanguage = normalizeLanguage(params.get("lang") ?? readBrowserStorageItem(LANGUAGE_STORAGE_KEY));
    const initialTicker = params.get("ticker");
    const initialUseSectorWeights = params.has(SECTOR_WEIGHTS_QUERY_PARAM)
      ? parseSectorWeightsFlag(params.get(SECTOR_WEIGHTS_QUERY_PARAM))
      : storedSettings.useSectorWeights;

    setLanguage(initialLanguage);
    setUseSectorWeights(initialUseSectorWeights);
    setSupplementalMetricSettings(storedSettings.supplementalMetrics);
    document.documentElement.lang = initialLanguage;

    if (!initialTicker) return;

    const cleanTicker = normalizeTicker(initialTicker);
    if (!cleanTicker) return;

    const timer = window.setTimeout(() => {
      setTicker(cleanTicker);
      void loadAnalysis(cleanTicker, undefined, initialLanguage, initialUseSectorWeights, storedSettings.supplementalMetrics);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalysis]);

  useEffect(() => {
    document.documentElement.lang = language;
    writeBrowserStorageItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    writeAnalysisSettings(APP_SETTINGS_STORAGE_KEY, { useSectorWeights, supplementalMetrics: supplementalMetricSettings });
  }, [supplementalMetricSettings, useSectorWeights]);

  useEffect(() => {
    function handleAnalysisRequest(event: Event) {
      const detail = (event as CustomEvent<AppAnalysisRequestDetail>).detail;
      const cleanTicker = normalizeTicker(detail?.ticker ?? "");
      if (!cleanTicker) return;

      setTicker(cleanTicker);
      setLanguage(detail.language);
      setUseSectorWeights(detail.settings.useSectorWeights);
      setSupplementalMetricSettings(detail.settings.supplementalMetrics);
      document.documentElement.lang = detail.language;
      void loadAnalysis(
        cleanTicker,
        undefined,
        detail.language,
        detail.settings.useSectorWeights,
        detail.settings.supplementalMetrics,
      );
    }

    window.addEventListener(APP_ANALYSIS_REQUEST_EVENT, handleAnalysisRequest);
    return () => window.removeEventListener(APP_ANALYSIS_REQUEST_EVENT, handleAnalysisRequest);
  }, [loadAnalysis]);

  useEffect(() => {
    function handleLanguageChange(event: Event) {
      const detail = (event as CustomEvent<AppLanguageChangeDetail>).detail;
      const nextLanguage = normalizeLanguage(detail?.language);
      setLanguage(nextLanguage);
      document.documentElement.lang = nextLanguage;

      const targetTicker = analysis?.symbol ?? lastTicker;
      if (targetTicker) {
        void loadAnalysis(targetTicker, undefined, nextLanguage);
        return;
      }

      setError("");
    }

    window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    return () => window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  }, [analysis?.symbol, lastTicker, loadAnalysis]);

  useEffect(() => {
    function handleSettingsChange(event: Event) {
      const detail = (event as CustomEvent<AppAnalysisSettingsChangeDetail>).detail;
      const nextSettings = detail?.settings ?? readAnalysisSettings(APP_SETTINGS_STORAGE_KEY);
      setUseSectorWeights(nextSettings.useSectorWeights);
      setSupplementalMetricSettings(nextSettings.supplementalMetrics);

      const targetTicker = analysis?.symbol ?? lastTicker;
      if (targetTicker) {
        void loadAnalysis(
          targetTicker,
          undefined,
          language,
          nextSettings.useSectorWeights,
          nextSettings.supplementalMetrics,
        );
      }
    }

    window.addEventListener(APP_ANALYSIS_SETTINGS_CHANGE_EVENT, handleSettingsChange);
    return () => window.removeEventListener(APP_ANALYSIS_SETTINGS_CHANGE_EVENT, handleSettingsChange);
  }, [analysis?.symbol, language, lastTicker, loadAnalysis]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<AppAnalysisStatusDetail>(APP_ANALYSIS_STATUS_EVENT, {
        detail: {
          lastTicker: analysis?.symbol ?? lastTicker,
          loading,
        },
      }),
    );
  }, [analysis?.symbol, lastTicker, loading]);

  function applyPeerGroup() {
    const targetTicker = analysis?.symbol ?? lastTicker ?? ticker;
    const peers = normalizePeerInput(peerInput, targetTicker);
    if (!targetTicker || !peers.length) return;

    savePeerGroup(targetTicker, peers);
    void loadAnalysis(targetTicker, peers);
  }

  function resetPeerGroup() {
    const targetTicker = analysis?.symbol ?? lastTicker ?? ticker;
    if (!targetTicker) return;

    removeSavedPeerGroup(targetTicker);
    setPeerInput(analysis?.recommendedPeerSymbols.join(", ") ?? "");
    void loadAnalysis(targetTicker, null);
  }

  async function copyPeerPrompt() {
    if (!analysis) return;

    await copyToClipboard(buildPeerSelectionPrompt(analysis, language));
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1800);
  }

  return (
    <main className="appShell">
        {analysis ? (
          <>
            <div className="scoreCompany">
              <span className="scoreCompanyLogo" aria-hidden="true" key={analysis.symbol}>
                <Image
                  alt=""
                  loading="lazy"
                  width={32}
                  height={32}
                  src={companyLogoUrl(analysis.symbol)}
                  onError={(event) => {
                    event.currentTarget.parentElement?.setAttribute("data-hidden", "true");
                  }}
                />
              </span>
              <h2>
                {analysis.symbol} · {analysis.name}
              </h2>
            </div>

            <section className="summaryBand" aria-label={t.aria.summary}>

              <div className="scoreBlock">
                <div className="scoreRing" style={{ "--score": analysis.score } as React.CSSProperties}>
                  <strong>{analysis.score}</strong>
                </div>
                <div className="scoreCopy">
                  <p>{t.scoreLabels[analysis.tone]}</p>
                  <p className="score">{analysis.score} / 100</p>
                </div>
              </div>

              <div className="companyGrid">
                <Fact label={t.facts.price} language={language} value={analysis.price} />
                <Fact label={t.facts.marketCap} language={language} value={analysis.marketCap} termKey="marketCap" />
                <Fact label={t.facts.sector} language={language} value={analysis.sector ?? analysis.industry} />
                <Fact label={t.facts.updated} language={language} value={asOf} />
              </div>
            </section>

            <div className="statusRow">
              <span className="miniChip">
                <BadgeDollarSign size={15} />
                {analysis.currency ?? t.currencyUnavailable}
              </span>
              <span className="miniChip">
                <ShieldCheck size={15} />
                {t.scoreMeta.confidence}: {analysis.confidence}/100
              </span>
              <span className="miniChip">
                <Calculator size={15} />
                {t.scoreMeta.rawScore}: {analysis.rawScore}/100
              </span>
              {analysis.riskPenalty ? (
                <span className="miniChip">
                  <CircleAlert size={15} />
                  {t.scoreMeta.riskPenalty}: -{analysis.riskPenalty}
                </span>
              ) : null}
              <span className="miniChip">
                <BarChart3 size={15} />
                {t.scoreMeta.profile}: {analysis.scoringProfile}
              </span>
              <span className="miniChip">
                <BarChart3 size={15} />
                <TermLabel
                  actualPeersSourceUrl={actualPeersSourceUrl}
                  label={t.peers.label}
                  language={language}
                  termKey="peers"
                />
                :{" "}
                {analysis.peerSymbols.length ? analysis.peerSymbols.join(", ") : t.notAvailable}
              </span>
              {analysis.exchange ? (
                <span className="miniChip">
                  <TrendingUp size={15} />
                  {analysis.exchange}
                </span>
              ) : null}
            </div>

            

            <section className={`peerEditor ${analysis.peerSource === "recommended" ? "peerEditorWarn" : ""}`}>
              <div className="peerEditorText">
                <span className={`peerSourceBadge ${analysis.peerSource}`}>
                  <UsersRound size={15} />
                  {analysis.peerSource === "manual"
                    ? t.peers.manualBadge
                    : analysis.peerSource === "actual"
                      ? t.peers.actualBadge
                      : t.peers.recommendedBadge}
                </span>
                <p>
                  {analysis.peerSource === "manual"
                    ? t.peers.manualText
                    : analysis.peerSource === "actual"
                      ? t.peers.actualText
                      : t.peers.recommendedText}
                </p>
                {analysis.recommendedPeerSymbols.length ? (
                  <small>
                    {t.peers.recommended}: {analysis.recommendedPeerSymbols.join(", ")}
                  </small>
                ) : null}
              </div>

              <div className="peerControls">
                <input
                  className="peerInput"
                  value={peerInput}
                  onChange={(event) => setPeerInput(event.target.value.toUpperCase())}
                  placeholder="MSFT, GOOGL, AMZN"
                  aria-label={t.aria.competitors}
                />
                <button
                  className="peerButton"
                  disabled={loading || !normalizePeerInput(peerInput, analysis.symbol).length}
                  title={t.peers.applyTitle}
                  type="button"
                  onClick={applyPeerGroup}
                >
                  <Save size={16} />
                  <span>{t.actions.apply}</span>
                </button>
                <button
                  className="peerButton prompt"
                  disabled={loading}
                  title={t.peers.promptTitle}
                  type="button"
                  onClick={() => void copyPeerPrompt()}
                >
                  <ClipboardCopy size={16} />
                  <span>{promptCopied ? t.copied : t.prompt}</span>
                </button>
                <button
                  className="peerButton reset"
                  disabled={loading}
                  title={t.peers.resetTitle}
                  type="button"
                  onClick={resetPeerGroup}
                >
                  <RotateCcw size={16} />
                  <span>{t.actions.reset}</span>
                </button>
              </div>
            </section>

            <section className="metricGrid" style={{marginBottom: '32px'}} aria-label={t.aria.metrics}>
              {analysis.indicators.map((indicator) => (
                <MetricCard
                  actualPeersSourceUrl={actualPeersSourceUrl}
                  indicator={indicator}
                  key={indicator.id}
                  language={language}
                  scoreAria={t.aria.score}
                  toneLabels={t.toneLabels}
                />
              ))}
            </section>

            {enabledSupplementalMetricIds.length ? (
              <SupplementalMetricsPanel
                enabledMetricIds={enabledSupplementalMetricIds}
                errors={supplementalErrors}
                language={language}
                loading={supplementalLoading}
                metrics={supplementalMetrics}
                notes={supplementalNotes}
              />
            ) : null}

            <p className="finePrint">
              <JoinedTextWithActualPeersLinks href={actualPeersSourceUrl} texts={analysis.dataNotes} />
            </p>
          </>
        ) : loading ? (
          <StatePanel icon={<Loader2 size={34} />} title={t.states.loadingTitle} text={t.states.loadingText} type="loading" />
        ) : error ? (
          <StatePanel icon={<AlertTriangle size={34} />} title={t.states.errorTitle} text={error} type="error" />
        ) : (
          <StatePanel icon={<Search size={34} />} title={t.states.emptyTitle} text={t.states.emptyText} type="empty" />
        )}
    </main>
  );
}

function SupplementalMetricsPanel({
  enabledMetricIds,
  errors,
  language,
  loading,
  metrics,
  notes,
}: {
  enabledMetricIds: readonly SupplementalMetricId[];
  errors: Partial<Record<SupplementalMetricId, string>>;
  language: Language;
  loading: Partial<Record<SupplementalMetricId, boolean>>;
  metrics: Partial<Record<SupplementalMetricId, SupplementalMetricResult>>;
  notes: Partial<Record<SupplementalMetricId, string[]>>;
}) {
  const t = supplementalMetricsCopy[language];
  const dataNotes = Array.from(new Set(enabledMetricIds.flatMap((id) => notes[id] ?? [])));

  return (
    <section className="supplementalGrid" aria-busy={enabledMetricIds.some((id) => loading[id])} aria-label={t.ariaLabel}>
      {enabledMetricIds.map((id) => {
        const metric = metrics[id];
        const error = errors[id];
        const isLoading = Boolean(loading[id]);
        const Icon = supplementalMetricIcons[id];

        return (
          <article className={`supplementalMetric ${id === "momentum" ? "supplementalMetricWide" : ""}`} key={id}>
            <div className="supplementalMetricTop">
              <span className="supplementalMetricIcon" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span>
                <TermLabel label={t.metrics[id]} language={language} termKey={termForLabel(t.metrics[id])} />
              </span>
            </div>
            <strong>
              {isLoading ? (
                <span className="supplementalLoadingValue">
                  <Loader2 className="spinning" size={16} />
                  {t.loading}
                </span>
              ) : (
                (metric?.value ?? uiCopy[language].notAvailable)
              )}
            </strong>
            {error && !isLoading ? <small className="supplementalMetricError">{error}</small> : null}
            {!error && metric?.detail && !isLoading ? <small>{metric.detail}</small> : null}
            {!error && metric?.chart && !isLoading ? <SupplementalMetricChart chart={metric.chart} language={language} /> : null}
          </article>
        );
      })}
      {dataNotes.length ? (
        <p className="supplementalNote">{dataNotes.join(" ")}</p>
      ) : null}
    </section>
  );
}

function SupplementalMetricChart({
  chart,
  language,
}: {
  chart: NonNullable<SupplementalMetricResult["chart"]>;
  language: Language;
}) {
  const points = chart.points.filter((point) => isFiniteChartNumber(point.price));
  if (points.length < 2) return null;

  const width = 1000;
  const height = 112;
  const top = 8;
  const bottom = 12;
  const plotHeight = height - top - bottom;
  const times = points.map((point) => Date.parse(point.date));
  const firstTime = times[0];
  const lastTime = times[times.length - 1];
  const hasTimeline = times.every(Number.isFinite) && lastTime > firstTime;
  const averageValues = points.map((point) => point.average).filter(isFiniteChartNumber);
  const values = [...points.map((point) => point.price), ...averageValues];
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  if (minValue === maxValue) {
    minValue -= Math.max(Math.abs(minValue) * 0.02, 1);
    maxValue += Math.max(Math.abs(maxValue) * 0.02, 1);
  } else {
    const padding = (maxValue - minValue) * 0.08;
    minValue -= padding;
    maxValue += padding;
  }

  const xFor = (point: (typeof points)[number], index: number) => {
    if (hasTimeline) {
      return ((Date.parse(point.date) - firstTime) / (lastTime - firstTime)) * width;
    }

    return (index / Math.max(points.length - 1, 1)) * width;
  };
  const yFor = (value: number) => top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const pricePath = svgPath(points.map((point, index) => ({ x: xFor(point, index), y: yFor(point.price) })));
  const averagePath = svgPath(
    points
      .map((point, index) =>
        isFiniteChartNumber(point.average) ? { x: xFor(point, index), y: yFor(point.average) } : undefined,
      )
      .filter((point): point is { x: number; y: number } => Boolean(point)),
  );
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const latestAverage = [...points].reverse().find((point) => isFiniteChartNumber(point.average))?.average;
  const title = `${chart.priceLabel}: ${formatChartMoney(lastPoint.price, chart.currency, language)}`;

  return (
    <figure className="momentumChart" aria-label={title}>
      <div className="momentumChartLegend">
        <span>
          <i className="momentumLegendSwatch price" aria-hidden="true" />
          {chart.priceLabel}: {formatChartMoney(lastPoint.price, chart.currency, language)}
        </span>
        {isFiniteChartNumber(latestAverage) ? (
          <span>
            <i className="momentumLegendSwatch average" aria-hidden="true" />
            {chart.averageLabel}: {formatChartMoney(latestAverage, chart.currency, language)}
          </span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <title>{title}</title>
        <line className="momentumChartGrid" x1="0" x2={width} y1={top + plotHeight * 0.25} y2={top + plotHeight * 0.25} />
        <line className="momentumChartGrid" x1="0" x2={width} y1={top + plotHeight * 0.5} y2={top + plotHeight * 0.5} />
        <line className="momentumChartGrid" x1="0" x2={width} y1={top + plotHeight * 0.75} y2={top + plotHeight * 0.75} />
        {averagePath ? <path className="momentumChartAverage" d={averagePath} /> : null}
        <path className="momentumChartPrice" d={pricePath} />
      </svg>
      <div className="momentumChartAxis" aria-hidden="true">
        <span>{formatChartDate(firstPoint.date, language)}</span>
        <span>{formatChartDate(lastPoint.date, language)}</span>
      </div>
    </figure>
  );
}

function Fact({
  label,
  language,
  value,
  termKey,
}: {
  label: string;
  language: Language;
  value?: string;
  termKey?: TermKey;
}) {
  return (
    <div className="fact">
      <span>
        <TermLabel label={label} language={language} termKey={termKey} />
      </span>
      <strong>{value ?? uiCopy[language].notAvailable}</strong>
    </div>
  );
}

function MetricCard({
  actualPeersSourceUrl,
  indicator,
  language,
  scoreAria,
  toneLabels,
}: {
  actualPeersSourceUrl?: string;
  indicator: IndicatorResult;
  language: Language;
  scoreAria: (score: number) => string;
  toneLabels: Record<MetricTone, string>;
}) {
  const Icon = metricIcons[indicator.id];
  const ToneIcon = toneIcons[indicator.tone];
  const fillClass = indicator.tone === "good" ? "" : indicator.tone;

  return (
    <article className="metricCard">
      <div className="metricHeader">
        <div className="metricIcon" aria-hidden="true">
          <Icon size={19} />
        </div>
        <div className="metricTitle">
          <h3>
            <TermLabel
              actualPeersSourceUrl={actualPeersSourceUrl}
              label={indicator.title}
              language={language}
              termKey={termForLabel(indicator.title)}
            />
          </h3>
          <small>
            <TermLabel
              actualPeersSourceUrl={actualPeersSourceUrl}
              label={indicator.subtitle}
              language={language}
              termKey={termForLabel(indicator.subtitle)}
            />
          </small>
        </div>
      </div>

      <p className="metricVerdict">{indicator.verdict}</p>
      <span className={`tonePill tone-${indicator.tone}`}>
        <ToneIcon size={15} />
        {toneLabels[indicator.tone]}
      </span>

      <ul className="evidenceList">
        {indicator.evidence.map((item) => (
          <li key={`${indicator.id}-${item.label}`}>
            <span>
              <TermLabel
                actualPeersSourceUrl={actualPeersSourceUrl}
                label={item.label}
                language={language}
                termKey={termForLabel(item.label)}
              />
            </span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>

      <div className="metricScore">
        <div className="scoreBar" aria-label={scoreAria(indicator.score)}>
          <div
            className={`scoreFill ${fillClass}`}
            style={{ "--fill": `${Math.max(4, indicator.score)}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </article>
  );
}

function TermLabel({
  actualPeersSourceUrl,
  label,
  language,
  termKey,
}: {
  actualPeersSourceUrl?: string;
  label: string;
  language: Language;
  termKey?: TermKey;
}) {
  const explanation = termKey ? termDefinitions[language][termKey] : undefined;

  if (!explanation) {
    return <>{label}</>;
  }

  if (termKey === "peers" && actualPeersSourceUrl) {
    return (
      <span className="tooltipTerm tooltipTermRich" tabIndex={0}>
        {label}
        <span className="tooltipBubble" role="tooltip">
          <TextWithActualPeersLink href={actualPeersSourceUrl} text={explanation} />
        </span>
      </span>
    );
  }

  return (
    <span className="tooltipTerm" data-tooltip={explanation} tabIndex={0}>
      {label}
    </span>
  );
}

function StatePanel({
  icon,
  title,
  text,
  type,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  type: "empty" | "loading" | "error";
}) {
  return (
    <section className={`${type}State`}>
      <div>
        {icon}
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </section>
  );
}

function buildPeerSelectionPrompt(analysis: AnalysisResult, language: Language) {
  if (language === "en") {
    const sector = analysis.sector ? `\nSector: ${analysis.sector}` : "";
    const industry = analysis.industry ? `\nIndustry: ${analysis.industry}` : "";
    const recommended = analysis.recommendedPeerSymbols.length
      ? `\nCurrent baseline peer group: ${analysis.recommendedPeerSymbols.join(", ")}`
      : "";

    return `I am analyzing ${analysis.symbol} (${analysis.name}) for a Q-GARP/GARP checklist.${sector}${industry}${recommended}

Help me choose a high-quality peer group for comparing growth, margins, and valuation.

Requirements:
1. Pick 5-8 direct public competitors with liquid tickers.
2. Prioritize similar business model, products, customers, revenue segments, geography, and maturity stage.
3. Do not add ETFs, indexes, holding companies, suppliers, or customers unless they are direct competitors.
4. If the company has several different business segments, explain which segment you use as the basis for the peer group.
5. Do not invent tickers. If a ticker is ambiguous, specify the exchange or replace it with a better option.

Return the answer in this format:
- Briefly: why this peer group fits.
- Tickers to paste into the field: TICKER1, TICKER2, TICKER3
- Who not to include and why.`;
  }

  const sector = analysis.sector ? `\nСектор: ${analysis.sector}` : "";
  const industry = analysis.industry ? `\nІндустрія: ${analysis.industry}` : "";
  const recommended = analysis.recommendedPeerSymbols.length
    ? `\nПоточна базова peer-група: ${analysis.recommendedPeerSymbols.join(", ")}`
    : "";

  return `Я аналізую компанію ${analysis.symbol} (${analysis.name}) для Q-GARP/GARP чекліста.${sector}${industry}${recommended}

Допоможи підібрати якісну peer-групу для порівняння росту, маржі та valuation.

Вимоги:
1. Обери 5-8 прямих публічних конкурентів із ліквідними тікерами.
2. Пріоритет - схожа бізнес-модель, продукти, клієнти, сегменти виручки, географія та стадія зрілості.
3. Не додавай ETF, індекси, холдинги, постачальників або клієнтів, якщо вони не є прямими конкурентами.
4. Якщо компанія має кілька різних бізнес-сегментів, поясни, який сегмент ти береш за основу для peer-групи.
5. Не вигадуй тікери. Якщо тікер неоднозначний, вкажи біржу або заміни на кращий варіант.

Поверни відповідь у такому форматі:
- Коротко: чому саме ця peer-група.
- Тікери для вставки в поле: TICKER1, TICKER2, TICKER3
- Кого не включати і чому.`;
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to a temporary textarea when browser permissions block Clipboard API.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

const PEER_STORAGE_KEY = "invest-rate.peer-groups.v1";

function normalizePeerInput(value: string, baseTicker?: string) {
  const baseSymbol = normalizeTicker(baseTicker ?? "");

  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map(normalizeTicker)
        .filter(Boolean)
        .filter((symbol) => symbol !== baseSymbol),
    ),
  ).slice(0, 8);
}

function readPeerGroups(): Record<string, string[]> {
  if (typeof window === "undefined") return {};

  try {
    const raw = readBrowserStorageItem(PEER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readSavedPeerGroup(ticker: string) {
  const groups = readPeerGroups();
  const symbol = normalizeTicker(ticker);
  const values = Array.isArray(groups[symbol]) ? groups[symbol] : [];
  return values.map(normalizeTicker).filter(Boolean).slice(0, 8);
}

function savePeerGroup(ticker: string, peers: string[]) {
  if (typeof window === "undefined") return;

  const symbol = normalizeTicker(ticker);
  if (!symbol) return;

  const groups = readPeerGroups();
  groups[symbol] = peers.map(normalizeTicker).filter(Boolean).slice(0, 8);
  writeBrowserStorageItem(PEER_STORAGE_KEY, JSON.stringify(groups));
}

function removeSavedPeerGroup(ticker: string) {
  if (typeof window === "undefined") return;

  const symbol = normalizeTicker(ticker);
  if (!symbol) return;

  const groups = readPeerGroups();
  delete groups[symbol];
  writeBrowserStorageItem(PEER_STORAGE_KEY, JSON.stringify(groups));
}

function analysisCacheKey(ticker: string, peers: string[], language: Language, useSectorWeights: boolean) {
  const symbol = normalizeTicker(ticker);
  const peerKey = normalizePeerInput(peers.join(","), symbol).join(",");
  return `${language}|${symbol}|${peerKey}|${useSectorWeights ? "sector-weights" : "baseline-weights"}`;
}

function readCachedAnalysis(key: string): AnalysisResult | null {
  if (typeof window === "undefined") return null;

  const cache = readAnalysisCache();
  const entry = cache[key];
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    delete cache[key];
    writeBrowserStorageItem(ANALYSIS_CACHE_STORAGE_KEY, JSON.stringify(cache));
    return null;
  }

  return entry.result;
}

function writeCachedAnalysis(key: string, result: AnalysisResult) {
  if (typeof window === "undefined") return;

  const cache = pruneAnalysisCache(readAnalysisCache());
  cache[key] = {
    result,
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
  };

  writeBrowserStorageItem(ANALYSIS_CACHE_STORAGE_KEY, JSON.stringify(pruneAnalysisCache(cache)));
}

function supplementalCacheKey(ticker: string, language: Language, metricId: SupplementalMetricId) {
  return `${language}|${normalizeTicker(ticker)}|${metricId}`;
}

function readCachedSupplementalMetric(key: string): { result: SupplementalMetricResult; dataNotes: string[] } | null {
  if (typeof window === "undefined") return null;

  const cache = readSupplementalCache();
  const entry = cache[key];
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    delete cache[key];
    writeBrowserStorageItem(SUPPLEMENTAL_CACHE_STORAGE_KEY, JSON.stringify(cache));
    return null;
  }

  return {
    result: entry.result,
    dataNotes: Array.isArray(entry.dataNotes) ? entry.dataNotes : [],
  };
}

function writeCachedSupplementalMetric(key: string, result: SupplementalMetricResult, dataNotes: string[]) {
  if (typeof window === "undefined") return;

  const cache = pruneSupplementalCache(readSupplementalCache());
  cache[key] = {
    dataNotes,
    result,
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
  };

  writeBrowserStorageItem(SUPPLEMENTAL_CACHE_STORAGE_KEY, JSON.stringify(pruneSupplementalCache(cache)));
}

function readAnalysisCache(): Record<string, CachedAnalysisEntry> {
  if (typeof window === "undefined") return {};

  try {
    const raw = readBrowserStorageItem(ANALYSIS_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readSupplementalCache(): Record<string, CachedSupplementalEntry> {
  if (typeof window === "undefined") return {};

  try {
    const raw = readBrowserStorageItem(SUPPLEMENTAL_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pruneAnalysisCache(cache: Record<string, CachedAnalysisEntry>) {
  const now = Date.now();
  const freshEntries = Object.entries(cache)
    .filter(([, entry]) => entry?.expiresAt > now && entry?.result)
    .sort(([, left], [, right]) => right.expiresAt - left.expiresAt)
    .slice(0, MAX_STORED_ANALYSES);

  return Object.fromEntries(freshEntries) as Record<string, CachedAnalysisEntry>;
}

function pruneSupplementalCache(cache: Record<string, CachedSupplementalEntry>) {
  const now = Date.now();
  const freshEntries = Object.entries(cache)
    .filter(([, entry]) => entry?.expiresAt > now && entry?.result)
    .sort(([, left], [, right]) => right.expiresAt - left.expiresAt)
    .slice(0, MAX_STORED_SUPPLEMENTAL_RESULTS);

  return Object.fromEntries(freshEntries) as Record<string, CachedSupplementalEntry>;
}

function enabledSupplementalMetricsFromSettings(settings: SupplementalMetricSettings) {
  return supplementalMetricIds.filter((id) => settings[id]);
}

function omitSupplementalKeys<T>(
  value: Partial<Record<SupplementalMetricId, T>>,
  metricIds: readonly SupplementalMetricId[],
) {
  const next = { ...value };
  for (const id of metricIds) {
    delete next[id];
  }
  return next;
}

function svgPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function isFiniteChartNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatChartMoney(value: number, currency = "USD", language: Language) {
  try {
    return new Intl.NumberFormat(localeForLanguage(language), {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  }
}

function formatChartDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat(localeForLanguage(language), {
    month: "short",
    year: "2-digit",
  }).format(date);
}
