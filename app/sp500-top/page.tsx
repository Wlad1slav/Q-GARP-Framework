"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUPPLEMENTAL_METRIC_SETTINGS,
  readAnalysisSettings,
  sectorWeightsSearchParam,
  SECTOR_WEIGHTS_QUERY_PARAM,
  SP500_TOP_SETTINGS_STORAGE_KEY,
  writeAnalysisSettings,
} from "@/lib/analysis-settings";
import type { MetricTone } from "@/lib/analysis-types";
import { companyLogoUrl } from "@/lib/company-logo";
import type { Sp500Constituent } from "@/lib/sp500";
import type { Sp500IndicatorId, Sp500TopFailure, Sp500TopItem, Sp500TopResponse } from "@/lib/sp500-top-types";
import { sp500IndicatorIds } from "@/lib/sp500-top-types";

type Language = "uk" | "en";
type MetricKey = "score" | Sp500IndicatorId;

type ConstituentsPayload = {
  constituents: Sp500Constituent[];
  asOf: string;
  sourceName: string;
  sourceUrl: string;
  message?: string;
};

const supportedLanguages = ["uk", "en"] as const;
const languageLabels: Record<Language, string> = { uk: "UA", en: "EN" };
const LANGUAGE_STORAGE_KEY = "invest-rate.language.v1";
const SP500_SCAN_CACHE_STORAGE_KEY = "invest-rate.sp500-scan.v4";
const SP500_SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const METHODOLOGY_SCORING_PROFILES_URL =
  "https://github.com/Wlad1slav/Q-GARP-Framework/blob/main/METHODOLOGY.md#3-scoring-profiles";
const BATCH_SIZE = 1;
const TOP_COUNT = 10;
const RANKING_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const RANKING_ALL_PAGE_SIZE = "all";

type RankingPageSize = (typeof RANKING_PAGE_SIZE_OPTIONS)[number] | typeof RANKING_ALL_PAGE_SIZE;

type StoredSp500Scan = {
  expiresAt: number;
  modes: Partial<Record<Sp500ScanMode, StoredSp500ScanMode>>;
};

type StoredSp500ScanMode = {
  items: Sp500TopItem[];
};

type Sp500ScanMode = "sectorWeights" | "baselineWeights";

type HeatmapItem = Sp500TopItem & {
  marketCapValueResolved: number;
  sectorLabel: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HeatmapView = {
  x: number;
  y: number;
  zoom: number;
};

type HeatmapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startView: HeatmapView;
  moved: boolean;
};

type HeatmapTile = {
  item: HeatmapItem;
  rect: Rect;
};

type RankedSp500Row = {
  item: Sp500TopItem;
  rank: number;
};

type HeatmapSectorLayout = {
  sector: string;
  rect: Rect;
  headerHeight: number;
  marketCapValue: number;
  tiles: HeatmapTile[];
};

const HEATMAP_WIDTH = 1000;
const HEATMAP_HEIGHT = 560;
const HEATMAP_SECTOR_GAP = 2;
const HEATMAP_TILE_GAP = 1;
const HEATMAP_MIN_ZOOM = 1;
const HEATMAP_MAX_ZOOM = 8;
const HEATMAP_ZOOM_SENSITIVITY = 0.0018;
const DEFAULT_HEATMAP_VIEW: HeatmapView = { x: 0, y: 0, zoom: HEATMAP_MIN_ZOOM };
const HEATMAP_SCORE_COLORS = ["#991F29", "#F23645", "#F77C80", "#FFDB78", "#42BD7F", "#089950", "#056636"] as const;
const HEATMAP_LEGEND_LABELS = ["0", "", "", "50", "", "", "100"] as const;

const indicatorIcons = {
  double: TrendingUp,
  valuation: BadgeDollarSign,
  growth: BarChart3,
  margins: ShieldCheck,
  peg: Calculator,
} satisfies Record<Sp500IndicatorId, typeof TrendingUp>;

const toneIcons = {
  good: CheckCircle2,
  watch: CircleAlert,
  bad: XCircle,
  unknown: AlertTriangle,
} satisfies Record<MetricTone, typeof CheckCircle2>;

const copy = {
  uk: {
    title: "Топ S&P 500",
    subtitle: "Лідери за п'ятьма Q-GARP індикаторами",
    home: "Чеклист тікера",
    source: "Список",
    overall: "Загальний score",
    peerNote:
      "Оцінки в топі рахуються тією ж дефолтною методологією, що й чекліст тікера: дефолтні peers підтягуються з ACTUAL_PEERS, а якщо для тікера там немає групи, використовується Yahoo fallback. Локально збережені manual peers з однотікерової сторінки тут не застосовуються.",
    tableTitle: "Детальний рейтинг",
    rankingSearchPlaceholder: "Пошук за тикером, компанією чи сектором",
    rankingNoMatches: "Нічого не знайдено за цим пошуком.",
    rankingShowing: "Показано",
    rankingRowsPerPage: "Рядків",
    rankingAllRows: "Усі",
    rankingPage: "Сторінка",
    rankingPrevious: "Назад",
    rankingNext: "Вперед",
    heatmap: {
      title: "Хітмапа S&P 500",
      subtitle: "Score компаній за секторами",
      allSectors: "Всі сектори",
      empty: "Хітмапа з'явиться після скану компаній з доступною капіталізацією.",
      unknownSector: "Інший сектор",
      legend: "Шкала score",
      stats: "Статистика",
      yahooProfile: "Yahoo Finance",
      close: "Закрити",
      sectorCap: "Капіталізація сектора",
      companies: "Компанії",
      labels: {
        score: "Score",
        rawScore: "Raw score",
        confidence: "Довіра",
        riskPenalty: "Штраф ризику",
        price: "Ціна",
        exchange: "Біржа",
        sector: "Сектор",
        industry: "Індустрія",
        marketCap: "Капіталізація",
        asOf: "Дані",
      },
    },
    emptyLeaders: "Очікує даних",
    noRows: "Ще немає оцінених компаній.",
    loadingList: "Завантажую список S&P 500",
    loadingListText: "Підтягую актуальні constituents.",
    failedListTitle: "Список не завантажено",
    currentBatch: "Батч",
    complete: "Скан завершено",
    idle: "Очікує запуску",
    scanning: "Сканую",
    stopped: "Пауза",
    progress: "Прогрес",
    settings: {
      title: "Налаштування sp500-top",
      sectorWeights: "Увімкнути ваги залежно від галузі",
      methodologyTitle: "Методологія scoring profiles",
      disabledTitle: "Зупини скан, щоб змінити налаштування",
    },
    actions: {
      start: "Сканувати",
      resume: "Продовжити",
      pause: "Пауза",
      reset: "Новий скан",
    },
    stats: {
      universe: "S&P 500",
      scanned: "Скановано",
      scored: "Оцінено",
      failed: "Помилки",
    },
    headers: {
      rank: "#",
      company: "Компанія",
      metric: "Метрика",
      total: "Score",
      confidence: "Довіра",
      sector: "Сектор",
      marketCap: "Капіталізація",
    },
    errors: {
      constituents: "Не вдалося завантажити список S&P 500.",
      scan: "Не вдалося виконати батч-скан.",
    },
    toneLabels: {
      good: "Сильно",
      watch: "Змішано",
      bad: "Слабко",
      unknown: "Даних мало",
    } satisfies Record<MetricTone, string>,
    indicators: {
      double: { title: "Подвоєння за 5 років", short: "Подвоєння" },
      valuation: { title: "Ціна проти ринку", short: "Valuation" },
      growth: { title: "Ріст проти конкурентів", short: "Ріст" },
      margins: { title: "Маржа й перевага", short: "Маржа" },
      peg: { title: "PEG з SBC", short: "PEG" },
    } satisfies Record<Sp500IndicatorId, { title: string; short: string }>,
  },
  en: {
    title: "S&P 500 Top",
    subtitle: "Leaders across the five Q-GARP indicators",
    home: "Ticker checklist",
    source: "List",
    overall: "Overall score",
    peerNote:
      "Top scores use the same default methodology as the ticker checklist: default peers load from ACTUAL_PEERS, with Yahoo fallback when a ticker has no ACTUAL_PEERS group. Browser-saved manual peers from the single-ticker page are not applied here.",
    tableTitle: "Detailed ranking",
    rankingSearchPlaceholder: "Search ticker, company, or sector",
    rankingNoMatches: "No companies match that search.",
    rankingShowing: "Showing",
    rankingRowsPerPage: "Rows",
    rankingAllRows: "All",
    rankingPage: "Page",
    rankingPrevious: "Previous",
    rankingNext: "Next",
    heatmap: {
      title: "S&P 500 Heatmap",
      subtitle: "Company scores by sector",
      allSectors: "All sectors",
      empty: "The heatmap will appear after scanned companies have market-cap data.",
      unknownSector: "Other sector",
      legend: "Score scale",
      stats: "Statistics",
      yahooProfile: "Yahoo Finance",
      close: "Close",
      sectorCap: "Sector market cap",
      companies: "Companies",
      labels: {
        score: "Score",
        rawScore: "Raw score",
        confidence: "Confidence",
        riskPenalty: "Risk penalty",
        price: "Price",
        exchange: "Exchange",
        sector: "Sector",
        industry: "Industry",
        marketCap: "Market cap",
        asOf: "Data",
      },
    },
    emptyLeaders: "Waiting for data",
    noRows: "No scored companies yet.",
    loadingList: "Loading the S&P 500 list",
    loadingListText: "Fetching current constituents.",
    failedListTitle: "List was not loaded",
    currentBatch: "Batch",
    complete: "Scan complete",
    idle: "Waiting",
    scanning: "Scanning",
    stopped: "Paused",
    progress: "Progress",
    settings: {
      title: "sp500-top settings",
      sectorWeights: "Enable industry-based weights",
      methodologyTitle: "Scoring profiles methodology",
      disabledTitle: "Pause the scan to change settings",
    },
    actions: {
      start: "Scan",
      resume: "Resume",
      pause: "Pause",
      reset: "New scan",
    },
    stats: {
      universe: "S&P 500",
      scanned: "Scanned",
      scored: "Scored",
      failed: "Errors",
    },
    headers: {
      rank: "#",
      company: "Company",
      metric: "Metric",
      total: "Score",
      confidence: "Confidence",
      sector: "Sector",
      marketCap: "Market cap",
    },
    errors: {
      constituents: "Could not load the S&P 500 list.",
      scan: "Could not run the batch scan.",
    },
    toneLabels: {
      good: "Strong",
      watch: "Mixed",
      bad: "Weak",
      unknown: "Low data",
    } satisfies Record<MetricTone, string>,
    indicators: {
      double: { title: "Doubles in 5 years", short: "Doubling" },
      valuation: { title: "Price vs market", short: "Valuation" },
      growth: { title: "Growth vs peers", short: "Growth" },
      margins: { title: "Margins and advantage", short: "Margins" },
      peg: { title: "PEG with SBC", short: "PEG" },
    } satisfies Record<Sp500IndicatorId, { title: string; short: string }>,
  },
} as const;

export default function Sp500TopPage() {
  const [language, setLanguage] = useState<Language>(() =>
    typeof window === "undefined" ? "uk" : normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)),
  );
  const [useSectorWeights, setUseSectorWeights] = useState(
    () => readAnalysisSettings(SP500_TOP_SETTINGS_STORAGE_KEY).useSectorWeights,
  );
  const [constituents, setConstituents] = useState<Sp500Constituent[]>([]);
  const [source, setSource] = useState<{ name: string; url: string; asOf: string } | null>(null);
  const [loadingConstituents, setLoadingConstituents] = useState(true);
  const [items, setItems] = useState<Sp500TopItem[]>([]);
  const [failed, setFailed] = useState<Sp500TopFailure[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [currentBatch, setCurrentBatch] = useState("");
  const [error, setError] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("score");
  const [rankingSearch, setRankingSearch] = useState("");
  const [rankingPage, setRankingPage] = useState(1);
  const [rankingPageSize, setRankingPageSize] = useState<RankingPageSize>(50);
  const [focusedHeatmapSector, setFocusedHeatmapSector] = useState<string | null>(null);
  const [selectedHeatmapItem, setSelectedHeatmapItem] = useState<HeatmapItem | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldStopRef = useRef(false);
  const didRestoreScanRef = useRef(false);
  const itemMapRef = useRef<Map<string, Sp500TopItem>>(new Map());
  const failedRef = useRef<Sp500TopFailure[]>([]);
  const processedRef = useRef<Set<string>>(new Set());
  const t = copy[language];

  useEffect(() => {
    const initialLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    document.documentElement.lang = initialLanguage;

    let active = true;

    async function loadConstituents() {
      setLoadingConstituents(true);
      setError("");

      try {
        const response = await fetch("/api/sp500-constituents");
        const payload = await readJsonPayload<ConstituentsPayload>(response, copy[initialLanguage].errors.constituents);

        if (!response.ok) {
          throw new Error(payload.message ?? copy[initialLanguage].errors.constituents);
        }

        if (!active) return;

        setConstituents(payload.constituents);
        setSource({
          name: payload.sourceName,
          url: payload.sourceUrl,
          asOf: payload.asOf,
        });
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : copy[initialLanguage].errors.constituents);
      } finally {
        if (active) setLoadingConstituents(false);
      }
    }

    void loadConstituents();

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    writeAnalysisSettings(SP500_TOP_SETTINGS_STORAGE_KEY, {
      useSectorWeights,
      supplementalMetrics: DEFAULT_SUPPLEMENTAL_METRIC_SETTINGS,
    });
  }, [useSectorWeights]);

  const constituentBySymbol = useMemo(
    () => new Map(constituents.map((constituent) => [constituent.symbol, constituent])),
    [constituents],
  );

  useEffect(() => {
    if (!constituents.length || didRestoreScanRef.current) return;
    didRestoreScanRef.current = true;

    const timer = window.setTimeout(() => {
      const restoredItems = readSp500ScanCache(constituents, useSectorWeights);
      if (!restoredItems.length) return;

      itemMapRef.current = new Map(restoredItems.map((item) => [item.symbol, item]));
      failedRef.current = [];
      processedRef.current = new Set(restoredItems.map((item) => item.symbol));
      setItems(restoredItems);
      setFailed([]);
      setProcessedCount(restoredItems.length);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [constituents, useSectorWeights]);

  const topByIndicator = useMemo(() => {
    return Object.fromEntries(
      sp500IndicatorIds.map((id) => [id, rankItems(items, id, TOP_COUNT)]),
    ) as Record<Sp500IndicatorId, Sp500TopItem[]>;
  }, [items]);

  const heatmapItems = useMemo(() => buildHeatmapItems(items, t.heatmap.unknownSector), [items, t.heatmap.unknownSector]);
  const activeFocusedHeatmapSector =
    focusedHeatmapSector && heatmapItems.some((item) => item.sectorLabel === focusedHeatmapSector) ? focusedHeatmapSector : null;
  const heatmapLayout = useMemo(
    () => buildHeatmapLayout(heatmapItems, activeFocusedHeatmapSector),
    [activeFocusedHeatmapSector, heatmapItems],
  );
  const activeSelectedHeatmapItem = selectedHeatmapItem
    ? (heatmapItems.find((item) => item.symbol === selectedHeatmapItem.symbol) ?? null)
    : null;
  const rankedRows = useMemo(
    () => rankItems(items, selectedMetric).map((item, index) => ({ item, rank: index + 1 })),
    [items, selectedMetric],
  );
  const filteredRankedRows = useMemo(() => filterRankedRows(rankedRows, rankingSearch), [rankedRows, rankingSearch]);
  const rankingPageCount =
    rankingPageSize === RANKING_ALL_PAGE_SIZE ? 1 : Math.max(1, Math.ceil(filteredRankedRows.length / rankingPageSize));
  const safeRankingPage = Math.min(rankingPage, rankingPageCount);
  const rankingPageStartIndex = rankingPageSize === RANKING_ALL_PAGE_SIZE ? 0 : (safeRankingPage - 1) * rankingPageSize;
  const visibleRankingRows = useMemo(() => {
    if (rankingPageSize === RANKING_ALL_PAGE_SIZE) return filteredRankedRows;
    return filteredRankedRows.slice(rankingPageStartIndex, rankingPageStartIndex + rankingPageSize);
  }, [filteredRankedRows, rankingPageSize, rankingPageStartIndex]);
  const rankingRangeStart = filteredRankedRows.length ? rankingPageStartIndex + 1 : 0;
  const rankingRangeEnd =
    rankingPageSize === RANKING_ALL_PAGE_SIZE
      ? filteredRankedRows.length
      : Math.min(rankingPageStartIndex + rankingPageSize, filteredRankedRows.length);
  const progress = constituents.length ? Math.round((processedCount / constituents.length) * 100) : 0;
  const isComplete = constituents.length > 0 && processedCount >= constituents.length;
  const statusText = scanning ? t.scanning : isComplete ? t.complete : processedCount ? t.stopped : t.idle;

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
  }

  function clearScanState(options: { removeCache?: boolean } = {}) {
    itemMapRef.current = new Map();
    failedRef.current = [];
    processedRef.current = new Set();
    if (options.removeCache) {
      removeSp500ScanCache();
    }
    setItems([]);
    setFailed([]);
    setProcessedCount(0);
    setCurrentBatch("");
    setFocusedHeatmapSector(null);
    setSelectedHeatmapItem(null);
  }

  function changeUseSectorWeights(nextUseSectorWeights: boolean) {
    if (nextUseSectorWeights === useSectorWeights || scanning) return;

    setUseSectorWeights(nextUseSectorWeights);
    restoreScanState(nextUseSectorWeights);
  }

  function restoreScanState(nextUseSectorWeights: boolean) {
    const restoredItems = readSp500ScanCache(constituents, nextUseSectorWeights);

    itemMapRef.current = new Map(restoredItems.map((item) => [item.symbol, item]));
    failedRef.current = [];
    processedRef.current = new Set(restoredItems.map((item) => item.symbol));
    setItems(restoredItems);
    setFailed([]);
    setProcessedCount(restoredItems.length);
    setCurrentBatch("");
    setFocusedHeatmapSector(null);
    setSelectedHeatmapItem(null);
  }

  function stopScan() {
    shouldStopRef.current = true;
    setStopping(true);
    abortRef.current?.abort();
  }

  async function startScan(reset = false) {
    if (!constituents.length || scanning) return;

    if (reset) {
      clearScanState({ removeCache: true });
    }

    shouldStopRef.current = false;
    setScanning(true);
    setStopping(false);
    setError("");

    const symbols = constituents.map((constituent) => constituent.symbol).filter((symbol) => !processedRef.current.has(symbol));

    for (let index = 0; index < symbols.length; index += BATCH_SIZE) {
      if (shouldStopRef.current) break;

      const batch = symbols.slice(index, index + BATCH_SIZE);
      setCurrentBatch(batch.join(", "));
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const payload = await fetchSp500TopBatch(batch, useSectorWeights, controller.signal);
        mergeBatch(payload, constituentBySymbol);

        try {
          const comparisonPayload = await fetchSp500TopBatch(batch, !useSectorWeights, controller.signal);
          mergeCachedModeBatch(comparisonPayload, constituentBySymbol, !useSectorWeights);
        } catch (caught) {
          if (isAbortError(caught)) break;
        }
      } catch (caught) {
        if (isAbortError(caught)) break;

        setError(caught instanceof Error ? caught.message : t.errors.scan);
        break;
      } finally {
        abortRef.current = null;
      }
    }

    setCurrentBatch("");
    setScanning(false);
    setStopping(false);
  }

  async function fetchSp500TopBatch(batch: string[], batchUseSectorWeights: boolean, signal: AbortSignal) {
    const params = new URLSearchParams({
      tickers: batch.join(","),
      [SECTOR_WEIGHTS_QUERY_PARAM]: sectorWeightsSearchParam(batchUseSectorWeights),
    });
    const response = await fetch(`/api/sp500-top?${params.toString()}`, {
      signal,
    });
    const payload = await readJsonPayload<Sp500TopResponse & { message?: string }>(response, t.errors.scan);

    if (!response.ok) {
      throw new Error(payload.message ?? t.errors.scan);
    }

    return payload;
  }

  function mergeBatch(payload: Sp500TopResponse, meta: Map<string, Sp500Constituent>) {
    for (const item of payload.items) {
      const constituent = meta.get(item.symbol);
      const enriched = {
        ...item,
        name: item.name || constituent?.name || item.symbol,
        sector: item.sector ?? constituent?.sector,
        industry: item.industry ?? constituent?.industry,
      };

      itemMapRef.current.set(enriched.symbol, enriched);
      processedRef.current.add(enriched.symbol);
    }

    const failedBySymbol = new Map(failedRef.current.map((item) => [item.symbol, item]));
    for (const item of payload.failed) {
      failedBySymbol.set(item.symbol, item);
      if (!isRetryableFailure(item.message)) {
        processedRef.current.add(item.symbol);
      }
    }

    failedRef.current = Array.from(failedBySymbol.values());
    const nextItems = Array.from(itemMapRef.current.values());
    setItems(nextItems);
    setFailed(failedRef.current);
    setProcessedCount(processedRef.current.size);
    writeSp500ScanCache(nextItems, useSectorWeights);
  }

  function mergeCachedModeBatch(payload: Sp500TopResponse, meta: Map<string, Sp500Constituent>, modeUseSectorWeights: boolean) {
    const cachedItems = readSp500ScanCache(constituents, modeUseSectorWeights);
    const itemBySymbol = new Map(cachedItems.map((item) => [item.symbol, item]));

    for (const item of payload.items) {
      const constituent = meta.get(item.symbol);
      itemBySymbol.set(item.symbol, {
        ...item,
        name: item.name || constituent?.name || item.symbol,
        sector: item.sector ?? constituent?.sector,
        industry: item.industry ?? constituent?.industry,
      });
    }

    writeSp500ScanCache(Array.from(itemBySymbol.values()), modeUseSectorWeights);
  }

  if (loadingConstituents) {
    return (
      <>
        <Sp500SettingsModule
          disabled={false}
          language={language}
          useSectorWeights={useSectorWeights}
          onUseSectorWeightsChange={changeUseSectorWeights}
        />
        <main className="appShell sp500Shell withSettings">
          <Sp500Header language={language} onLanguageChange={changeLanguage} />
          <StatePanel icon={<Loader2 size={34} />} title={t.loadingList} text={t.loadingListText} type="loading" />
        </main>
      </>
    );
  }

  if (error && !constituents.length) {
    return (
      <>
        <Sp500SettingsModule
          disabled={false}
          language={language}
          useSectorWeights={useSectorWeights}
          onUseSectorWeightsChange={changeUseSectorWeights}
        />
        <main className="appShell sp500Shell withSettings">
          <Sp500Header language={language} onLanguageChange={changeLanguage} />
          <StatePanel icon={<AlertTriangle size={34} />} title={t.failedListTitle} text={error} type="error" />
        </main>
      </>
    );
  }

  return (
    <>
      <Sp500SettingsModule
        disabled={scanning}
        language={language}
        useSectorWeights={useSectorWeights}
        onUseSectorWeightsChange={changeUseSectorWeights}
      />
      <main className="appShell sp500Shell withSettings">
        <Sp500Header language={language} onLanguageChange={changeLanguage} />

      <section className="sp500ScanBand" aria-label={t.progress}>
        <div className="scanMain">
          <div className="scanTitleRow">
            <span className={`scanStatus ${scanning ? "active" : isComplete ? "done" : ""}`}>
              {scanning ? <Loader2 className="spinning" size={15} /> : <BarChart3 size={15} />}
              {statusText}
            </span>
            {source ? (
              <a className="sourceLink" href={source.url} target="_blank" rel="noreferrer">
                {t.source}: {source.name}
              </a>
            ) : null}
          </div>
          <div className="scanProgress" aria-label={`${t.progress}: ${progress}%`}>
            <div className="scanProgressFill" style={{ width: `${progress}%` }} />
          </div>
          <p className="scanBatch">
            {currentBatch ? `${t.currentBatch}: ${currentBatch}` : `${t.progress}: ${progress}%`}
          </p>
        </div>

        <div className="scanControls">
          <button
            className="primaryButton"
            disabled={scanning || !constituents.length}
            type="button"
            onClick={() => void startScan(false)}
          >
            {scanning ? <Loader2 className="spinning" size={18} /> : <Play size={18} />}
            <span>{processedCount ? t.actions.resume : t.actions.start}</span>
          </button>
          <button
            className="iconButton secondaryButton"
            disabled={!scanning || stopping}
            title={t.actions.pause}
            type="button"
            onClick={stopScan}
          >
            <Pause size={18} />
          </button>
          <button
            className="iconButton secondaryButton"
            disabled={scanning || !constituents.length}
            title={t.actions.reset}
            type="button"
            onClick={() => void startScan(true)}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="scanStats">
          <ScanStat label={t.stats.universe} value={constituents.length} />
          <ScanStat label={t.stats.scanned} value={processedCount} />
          <ScanStat label={t.stats.scored} value={items.length} />
          <ScanStat label={t.stats.failed} value={failed.length} />
        </div>
      </section>

      {error ? (
        <div className="scanAlert" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      <p className="finePrint sp500FinePrint">{t.peerNote}</p>

      <Sp500Heatmap
        focusedSector={activeFocusedHeatmapSector}
        items={heatmapItems}
        language={language}
        layout={heatmapLayout}
        onFocusSector={setFocusedHeatmapSector}
        onResetZoom={() => setFocusedHeatmapSector(null)}
        onSelectItem={setSelectedHeatmapItem}
      />

      <section className="leaderGrid" aria-label={t.subtitle}>
        {sp500IndicatorIds.map((id) => (
          <LeaderboardPanel
            id={id}
            items={topByIndicator[id]}
            key={id}
            language={language}
            selected={selectedMetric === id}
            onSelect={() => setSelectedMetric(id)}
          />
        ))}
      </section>

      <section className="rankingSection">
        <div className="rankingHeader">
          <div>
            <h2>{t.tableTitle}</h2>
            <p>{selectedMetric === "score" ? t.overall : t.indicators[selectedMetric].title}</p>
          </div>
          <div className="rankingControls">
            <div className="metricTabs" role="group" aria-label={t.tableTitle}>
              <button
                aria-pressed={selectedMetric === "score"}
                className={`metricTab ${selectedMetric === "score" ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setSelectedMetric("score");
                  setRankingPage(1);
                }}
              >
                {t.overall}
              </button>
              {sp500IndicatorIds.map((id) => (
                <button
                  aria-pressed={selectedMetric === id}
                  className={`metricTab ${selectedMetric === id ? "active" : ""}`}
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelectedMetric(id);
                    setRankingPage(1);
                  }}
                >
                  {t.indicators[id].short}
                </button>
              ))}
            </div>

            <label className="rankingSearch">
              <Search size={16} />
              <input
                aria-label={t.rankingSearchPlaceholder}
                placeholder={t.rankingSearchPlaceholder}
                type="search"
                value={rankingSearch}
                onChange={(event) => {
                  setRankingSearch(event.currentTarget.value);
                  setRankingPage(1);
                }}
              />
            </label>
          </div>
        </div>

        {items.length && filteredRankedRows.length ? (
          <>
            <RankingTable rows={visibleRankingRows} language={language} metric={selectedMetric} />
            <RankingPagination
              language={language}
              page={safeRankingPage}
              pageCount={rankingPageCount}
              pageSize={rankingPageSize}
              rangeEnd={rankingRangeEnd}
              rangeStart={rankingRangeStart}
              total={filteredRankedRows.length}
              onPageChange={setRankingPage}
              onPageSizeChange={(pageSize) => {
                setRankingPageSize(pageSize);
                setRankingPage(1);
              }}
            />
          </>
        ) : items.length ? (
          <div className="rankingEmpty">{t.rankingNoMatches}</div>
        ) : (
          <div className="rankingEmpty">{t.noRows}</div>
        )}
      </section>

      {activeSelectedHeatmapItem ? (
        <HeatmapStatsModal item={activeSelectedHeatmapItem} language={language} onClose={() => setSelectedHeatmapItem(null)} />
      ) : null}
      </main>
    </>
  );
}

function Sp500SettingsModule({
  disabled,
  language,
  useSectorWeights,
  onUseSectorWeightsChange,
}: {
  disabled: boolean;
  language: Language;
  useSectorWeights: boolean;
  onUseSectorWeightsChange: (enabled: boolean) => void;
}) {
  const t = copy[language].settings;
  const [open, setOpen] = useState(false);
  const menuId = "sp500-settings-menu";

  return (
    <aside className="settingsModule" aria-label={t.title}>
      <button
        className="settingsMenuButton"
        type="button"
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={t.title}
        title={t.title}
        onClick={() => setOpen((current) => !current)}
      >
        <Settings size={16} />
      </button>
      <div className="settingsDropdown" hidden={!open} id={menuId}>
        <div className="settingsModuleHeader">
          <Settings size={16} />
          <strong>{t.title}</strong>
        </div>
        <div className="settingsOption">
          <label className={`settingsToggleLabel ${disabled ? "disabled" : ""}`} title={disabled ? t.disabledTitle : undefined}>
            <input
              checked={useSectorWeights}
              disabled={disabled}
              type="checkbox"
              onChange={(event) => onUseSectorWeightsChange(event.currentTarget.checked)}
            />
            <span className="settingsSwitch" aria-hidden="true" />
            <span>{t.sectorWeights}</span>
          </label>
          <a
            className="settingsHelpLink"
            href={METHODOLOGY_SCORING_PROFILES_URL}
            target="_blank"
            rel="noreferrer"
            title={t.methodologyTitle}
          >
            <span>METHODOLOGY.md</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </aside>
  );
}

function Sp500Header({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const t = copy[language];

  return (
    <header className="topBar sp500TopBar">
      <div className="brand">
        <div className="brandMark" aria-hidden="true">
          <BarChart3 size={23} />
        </div>
        <div className="brandText">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <div className="topActions sp500TopActions">
        <Link className="githubLink" href="/">
          <ArrowLeft size={17} />
          <span>{t.home}</span>
        </Link>
        <div className="languageToggle" role="group" aria-label="Language">
          {supportedLanguages.map((nextLanguage) => (
            <button
              aria-pressed={language === nextLanguage}
              className={`languageOption ${language === nextLanguage ? "active" : ""}`}
              key={nextLanguage}
              type="button"
              onClick={() => onLanguageChange(nextLanguage)}
            >
              {languageLabels[nextLanguage]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function ScanStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="scanStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Sp500Heatmap({
  focusedSector,
  items,
  language,
  layout,
  onFocusSector,
  onResetZoom,
  onSelectItem,
}: {
  focusedSector: string | null;
  items: HeatmapItem[];
  language: Language;
  layout: HeatmapSectorLayout[];
  onFocusSector: (sector: string) => void;
  onResetZoom: () => void;
  onSelectItem: (item: HeatmapItem) => void;
}) {
  const t = copy[language].heatmap;
  const focusedLayout = focusedSector ? layout.find((sector) => sector.sector === focusedSector) : undefined;
  const heatmapViewScope = `${focusedSector ?? "all"}:${items.length ? "data" : "empty"}`;
  const heatmapCanvasRef = useRef<HTMLDivElement | null>(null);
  const heatmapDragRef = useRef<HeatmapDragState | null>(null);
  const suppressHeatmapClickRef = useRef(false);
  const [isPanningHeatmap, setIsPanningHeatmap] = useState(false);
  const [heatmapViewState, setHeatmapViewState] = useState<{ scope: string; view: HeatmapView }>(() => ({
    scope: heatmapViewScope,
    view: DEFAULT_HEATMAP_VIEW,
  }));
  const heatmapView = heatmapViewState.scope === heatmapViewScope ? heatmapViewState.view : DEFAULT_HEATMAP_VIEW;
  const heatmapViewport = heatmapViewportFromView(heatmapView);
  const hasHeatmapZoom = heatmapView.zoom > HEATMAP_MIN_ZOOM + 0.001;

  function resetHeatmapView() {
    setHeatmapViewState({ scope: heatmapViewScope, view: DEFAULT_HEATMAP_VIEW });
  }

  useEffect(() => {
    const element = heatmapCanvasRef.current;
    if (!element) return;
    const canvasElement = element;

    function handleNativeHeatmapWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = canvasElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const pointerX = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
      const pointerY = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);

      setHeatmapViewState((currentState) => {
        const currentView = currentState.scope === heatmapViewScope ? currentState.view : DEFAULT_HEATMAP_VIEW;
        return {
          scope: heatmapViewScope,
          view: zoomHeatmapView(currentView, pointerX, pointerY, normalizedWheelDelta(event)),
        };
      });
    }

    canvasElement.addEventListener("wheel", handleNativeHeatmapWheel, { passive: false });

    return () => {
      canvasElement.removeEventListener("wheel", handleNativeHeatmapWheel);
    };
  }, [heatmapViewScope]);

  function handleResetView() {
    finishHeatmapPan();
    resetHeatmapView();
    onResetZoom();
  }

  function handleFocusSector(sector: string) {
    finishHeatmapPan();
    resetHeatmapView();
    onFocusSector(sector);
  }

  function handleHeatmapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!hasHeatmapZoom || event.button !== 0) return;

    heatmapDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startView: heatmapView,
      moved: false,
    };
  }

  function handleHeatmapPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = heatmapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (!drag.moved && Math.hypot(deltaX, deltaY) > 3) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanningHeatmap(true);
    }

    if (!drag.moved) return;

    event.preventDefault();
    setHeatmapViewState({
      scope: heatmapViewScope,
      view: panHeatmapView(drag.startView, deltaX, deltaY, rect.width, rect.height),
    });
  }

  function handleHeatmapPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const moved = finishHeatmapPan(event.pointerId, event.currentTarget);
    if (moved) {
      suppressHeatmapClickRef.current = true;
    }
  }

  function handleHeatmapPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    finishHeatmapPan(event.pointerId, event.currentTarget);
  }

  function handleHeatmapClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressHeatmapClickRef.current) return;

    suppressHeatmapClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function finishHeatmapPan(pointerId?: number, element?: HTMLDivElement) {
    const drag = heatmapDragRef.current;
    if (!drag || (typeof pointerId === "number" && drag.pointerId !== pointerId)) return false;

    if (element?.hasPointerCapture(drag.pointerId)) {
      element.releasePointerCapture(drag.pointerId);
    }

    heatmapDragRef.current = null;
    setIsPanningHeatmap(false);
    return drag.moved;
  }

  return (
    <section className="heatmapSection" aria-label={t.title}>
      <div className="heatmapHeader">
        <div>
          <h2>{t.title}</h2>
          <p>
            {focusedLayout
              ? `${focusedLayout.sector} · ${formatCompactNumber(focusedLayout.marketCapValue, language)} · ${focusedLayout.tiles.length}`
              : t.subtitle}
          </p>
        </div>

        <div className="heatmapHeaderTools">
          {focusedSector || hasHeatmapZoom ? (
            <button className="heatmapToolButton" type="button" onClick={handleResetView}>
              <Minimize2 size={16} />
              <span>{t.allSectors}</span>
            </button>
          ) : null}

          <div className="heatmapLegend" aria-label={t.legend}>
            {HEATMAP_SCORE_COLORS.map((color, index) => (
              <span
                className="heatmapLegendStop"
                key={color}
                style={{ backgroundColor: color, color: heatmapTextColor(color) }}
              >
                {HEATMAP_LEGEND_LABELS[index]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {items.length ? (
        <div
          className={`heatmapCanvas ${hasHeatmapZoom ? "zoomed" : ""} ${isPanningHeatmap ? "panning" : ""}`}
          ref={heatmapCanvasRef}
          onClickCapture={handleHeatmapClickCapture}
          onPointerCancel={handleHeatmapPointerCancel}
          onPointerDown={handleHeatmapPointerDown}
          onPointerMove={handleHeatmapPointerMove}
          onPointerUp={handleHeatmapPointerUp}
        >
          {layout.map((sector) => (
            <div className="heatmapSector" key={sector.sector} style={rectToViewportStyle(sector.rect, heatmapViewport)}>
              <button
                className="heatmapSectorButton"
                style={{ height: `${(sector.headerHeight / Math.max(sector.rect.height, 1)) * 100}%` }}
                title={`${sector.sector}: ${formatCompactNumber(sector.marketCapValue, language)}`}
                type="button"
                onClick={() => handleFocusSector(sector.sector)}
              >
                <span>{sector.sector}</span>
                <small>{formatCompactNumber(sector.marketCapValue, language)}</small>
                {!focusedSector ? <Maximize2 size={12} /> : null}
              </button>

              {sector.tiles.map((tile) => {
                const item = tile.item;
                const localRect = relativeRect(tile.rect, sector.rect);
                const colorStyle = scoreColorStyle(item.score);

                return (
                  <button
                    className={`heatmapTile ${heatmapTileClass(tile.rect, heatmapView.zoom)}`}
                    key={item.symbol}
                    style={{
                      ...rectToStyle(localRect, sector.rect.width, sector.rect.height),
                      ...colorStyle,
                    }}
                    title={`${item.symbol}: ${item.score}/100 · ${item.marketCap ?? formatCompactNumber(item.marketCapValueResolved, language)}`}
                    type="button"
                    onClick={() => onSelectItem(item)}
                  >
                    <span className="heatmapTileLogo" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        loading="lazy"
                        src={companyLogoUrl(item.symbol)}
                        onError={(event) => {
                          event.currentTarget.parentElement?.setAttribute("data-hidden", "true");
                        }}
                      />
                    </span>
                    <span className="heatmapTileSymbol">{item.symbol}</span>
                    <strong>{item.score}</strong>
                    <small>{item.marketCap ?? formatCompactNumber(item.marketCapValueResolved, language)}</small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="heatmapEmpty">{t.empty}</div>
      )}
    </section>
  );
}

function HeatmapStatsModal({
  item,
  language,
  onClose,
}: {
  item: HeatmapItem;
  language: Language;
  onClose: () => void;
}) {
  const t = copy[language].heatmap;
  const titleId = `heatmapStats-${item.symbol.replace(/[^a-z0-9_-]/gi, "-")}`;
  const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}`;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="heatmapDialogBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="heatmapDialog" aria-labelledby={titleId} aria-modal="true" role="dialog">
        <div className="heatmapDialogTop">
          <div className="heatmapDialogIdentity">
            <span>{item.symbol}</span>
            <h3 id={titleId}>{item.name}</h3>
            <p>{[item.sectorLabel, item.industry].filter(Boolean).join(" · ")}</p>
          </div>

          <button className="iconButton secondaryButton heatmapCloseButton" title={t.close} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="heatmapDialogMain">
          <div className="heatmapDialogScore" style={scoreColorStyle(item.score)}>
            <strong>{item.score}</strong>
            <span>{t.labels.score}</span>
          </div>

          <div className="heatmapStatsGrid">
            <HeatmapStat label={t.labels.marketCap} value={item.marketCap ?? formatCompactNumber(item.marketCapValueResolved, language)} />
            <HeatmapStat label={t.labels.price} value={item.price} />
            <HeatmapStat label={t.labels.confidence} value={`${item.confidence}/100`} />
            <HeatmapStat label={t.labels.rawScore} value={`${item.rawScore}/100`} />
            <HeatmapStat label={t.labels.riskPenalty} value={`-${item.riskPenalty}`} />
            <HeatmapStat label={t.labels.exchange} value={item.exchange} />
            <HeatmapStat label={t.labels.sector} value={item.sectorLabel} />
            <HeatmapStat label={t.labels.asOf} value={formatDateTime(item.asOf, language)} />
          </div>
        </div>

        <div className="heatmapIndicatorGrid">
          {sp500IndicatorIds.map((id) => {
            const indicator = item.indicators[id];

            return (
              <div className={`heatmapIndicator tone-${indicator.tone}`} key={id}>
                <span>{copy[language].indicators[id].short}</span>
                <strong>{indicator.score}</strong>
                <small>{indicator.confidence}/100</small>
              </div>
            );
          })}
        </div>

        <a className="heatmapYahooLink" href={yahooUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          <span>{t.yahooProfile}</span>
        </a>
      </section>
    </div>
  );
}

function HeatmapStat({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="heatmapStat">
      <span>{label}</span>
      <strong>{value ?? "N/A"}</strong>
    </div>
  );
}

function LeaderboardPanel({
  id,
  items,
  language,
  selected,
  onSelect,
}: {
  id: Sp500IndicatorId;
  items: Sp500TopItem[];
  language: Language;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = copy[language];
  const Icon = indicatorIcons[id];

  return (
    <article className={`leaderPanel ${selected ? "active" : ""}`}>
      <button className="leaderPanelButton" type="button" onClick={onSelect}>
        <span className="metricIcon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span>
          <strong>{t.indicators[id].short}</strong>
          <small>{t.indicators[id].title}</small>
        </span>
      </button>

      <ol className="leaderList">
        {items.length ? (
          items.map((item, index) => <LeaderRow item={item} key={`${id}-${item.symbol}`} metric={id} rank={index + 1} />)
        ) : (
          <li className="leaderEmpty">{t.emptyLeaders}</li>
        )}
      </ol>
    </article>
  );
}

function LeaderRow({ item, metric, rank }: { item: Sp500TopItem; metric: Sp500IndicatorId; rank: number }) {
  const score = metricValue(item, metric);

  return (
    <li className="leaderRow">
      <span className="rankBadge">{rank}</span>
      <span className="leaderCompany">
        <strong>{item.symbol}</strong>
        <small>{item.name}</small>
      </span>
      <strong className="leaderScore">{score}</strong>
    </li>
  );
}

function RankingTable({ rows, language, metric }: { rows: RankedSp500Row[]; language: Language; metric: MetricKey }) {
  const t = copy[language];

  return (
    <div className="rankingTableWrap">
      <table className="rankingTable">
        <thead>
          <tr>
            <th>{t.headers.rank}</th>
            <th>{t.headers.company}</th>
            <th>{t.headers.metric}</th>
            <th>{t.headers.total}</th>
            <th>{t.headers.confidence}</th>
            <th>{t.headers.sector}</th>
            <th>{t.headers.marketCap}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, rank }) => (
            <RankingRow item={item} key={`${metric}-${item.symbol}`} language={language} metric={metric} rank={rank} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingPagination({
  language,
  page,
  pageCount,
  pageSize,
  rangeEnd,
  rangeStart,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  language: Language;
  page: number;
  pageCount: number;
  pageSize: RankingPageSize;
  rangeEnd: number;
  rangeStart: number;
  total: number;
  onPageChange: (page: number | ((page: number) => number)) => void;
  onPageSizeChange: (pageSize: RankingPageSize) => void;
}) {
  const t = copy[language];

  return (
    <div className="rankingPagination">
      <div className="rankingPageSummary">
        {t.rankingShowing} {rangeStart}-{rangeEnd} / {total}
      </div>

      <label className="rankingPageSize">
        <span>{t.rankingRowsPerPage}</span>
        <select value={String(pageSize)} onChange={(event) => onPageSizeChange(parseRankingPageSize(event.currentTarget.value))}>
          {RANKING_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={RANKING_ALL_PAGE_SIZE}>{t.rankingAllRows}</option>
        </select>
      </label>

      <div className="rankingPageButtons">
        <button
          className="iconButton secondaryButton"
          disabled={page <= 1}
          title={t.rankingPrevious}
          type="button"
          onClick={() => onPageChange((currentPage) => Math.max(1, currentPage - 1))}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {t.rankingPage} {page} / {pageCount}
        </span>
        <button
          className="iconButton secondaryButton"
          disabled={page >= pageCount}
          title={t.rankingNext}
          type="button"
          onClick={() => onPageChange((currentPage) => Math.min(pageCount, currentPage + 1))}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

function RankingRow({
  item,
  language,
  metric,
  rank,
}: {
  item: Sp500TopItem;
  language: Language;
  metric: MetricKey;
  rank: number;
}) {
  const t = copy[language];
  const tone = metric === "score" ? item.tone : item.indicators[metric].tone;
  const ToneIcon = toneIcons[tone];

  return (
    <tr>
      <td className="rankCell">{rank}</td>
      <td>
        <div className="tableCompany">
          <span className="tableCompanyLogo" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              loading="lazy"
              src={companyLogoUrl(item.symbol)}
              onError={(event) => {
                event.currentTarget.parentElement?.setAttribute("data-hidden", "true");
              }}
            />
          </span>
          <span className="tableCompanyText">
            <strong>{item.symbol}</strong>
            <span>{item.name}</span>
          </span>
        </div>
      </td>
      <td>
        <span className={`tonePill tone-${tone}`}>
          <ToneIcon size={14} />
          {metricValue(item, metric)}
        </span>
      </td>
      <td>{item.score}</td>
      <td>{metricConfidence(item, metric)}</td>
      <td>{item.sector ?? t.emptyLeaders}</td>
      <td>{item.marketCap ?? t.emptyLeaders}</td>
    </tr>
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
  type: "loading" | "error";
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

function rankItems(items: Sp500TopItem[], metric: MetricKey, limit = Number.POSITIVE_INFINITY) {
  const sorted = [...items].sort((left, right) => {
    const scoreDelta = metricValue(right, metric) - metricValue(left, metric);
    if (scoreDelta) return scoreDelta;

    const confidenceDelta = metricConfidence(right, metric) - metricConfidence(left, metric);
    if (confidenceDelta) return confidenceDelta;

    return right.score - left.score || left.symbol.localeCompare(right.symbol);
  });

  return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

function filterRankedRows(rows: RankedSp500Row[], queryValue: string) {
  const query = normalizeSearchQuery(queryValue);
  if (!query) return rows;

  return rows.filter(({ item }) =>
    [item.symbol, item.name, item.sector, item.industry, item.exchange].some((value) => normalizeSearchQuery(value ?? "").includes(query)),
  );
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}

function parseRankingPageSize(value: string): RankingPageSize {
  if (value === RANKING_ALL_PAGE_SIZE) return RANKING_ALL_PAGE_SIZE;

  const parsed = Number(value);
  return RANKING_PAGE_SIZE_OPTIONS.includes(parsed as (typeof RANKING_PAGE_SIZE_OPTIONS)[number])
    ? (parsed as (typeof RANKING_PAGE_SIZE_OPTIONS)[number])
    : 50;
}

function metricValue(item: Sp500TopItem, metric: MetricKey) {
  return metric === "score" ? item.score : (item.indicators[metric]?.score ?? 0);
}

function metricConfidence(item: Sp500TopItem, metric: MetricKey) {
  return metric === "score" ? item.confidence : (item.indicators[metric]?.confidence ?? 0);
}

function buildHeatmapItems(items: Sp500TopItem[], unknownSector: string): HeatmapItem[] {
  return items
    .map((item) => {
      const marketCapValue = resolveMarketCapValue(item);
      if (typeof marketCapValue !== "number" || !Number.isFinite(marketCapValue) || marketCapValue <= 0) return undefined;

      return {
        ...item,
        marketCapValueResolved: marketCapValue,
        sectorLabel: item.sector?.trim() || unknownSector,
      };
    })
    .filter((item): item is HeatmapItem => Boolean(item))
    .sort((left, right) => right.marketCapValueResolved - left.marketCapValueResolved);
}

function buildHeatmapLayout(items: HeatmapItem[], focusedSector: string | null): HeatmapSectorLayout[] {
  const sectors = groupHeatmapItems(items);
  const visibleSectors = focusedSector ? sectors.filter((sector) => sector.sector === focusedSector) : sectors;

  if (!visibleSectors.length) return [];

  const sectorRects = focusedSector
    ? visibleSectors.map((sector) => ({
        item: sector,
        rect: { x: 0, y: 0, width: HEATMAP_WIDTH, height: HEATMAP_HEIGHT },
      }))
    : layoutTreemap(
        visibleSectors.map((sector) => ({ item: sector, value: sector.marketCapValue })),
        { x: 0, y: 0, width: HEATMAP_WIDTH, height: HEATMAP_HEIGHT },
      );

  return sectorRects.map(({ item: sector, rect }) => {
    const sectorRect = focusedSector ? rect : insetRect(rect, HEATMAP_SECTOR_GAP);
    const headerHeight = heatmapSectorHeaderHeight(sectorRect, Boolean(focusedSector));
    const contentPadding = focusedSector ? 4 : sectorRect.width > 70 && sectorRect.height > 56 ? 3 : 1.5;
    const contentRect = {
      x: sectorRect.x + contentPadding,
      y: sectorRect.y + headerHeight,
      width: Math.max(0, sectorRect.width - contentPadding * 2),
      height: Math.max(0, sectorRect.height - headerHeight - contentPadding),
    };
    const tiles = layoutTreemap(
      sector.items.map((item) => ({ item, value: item.marketCapValueResolved })),
      contentRect,
    ).map((tile) => ({
      item: tile.item,
      rect: insetRect(tile.rect, HEATMAP_TILE_GAP),
    }));

    return {
      sector: sector.sector,
      rect: sectorRect,
      headerHeight,
      marketCapValue: sector.marketCapValue,
      tiles,
    };
  });
}

function groupHeatmapItems(items: HeatmapItem[]) {
  const bySector = new Map<string, HeatmapItem[]>();

  for (const item of items) {
    const sectorItems = bySector.get(item.sectorLabel) ?? [];
    sectorItems.push(item);
    bySector.set(item.sectorLabel, sectorItems);
  }

  return Array.from(bySector.entries())
    .map(([sector, sectorItems]) => ({
      sector,
      items: sectorItems.sort((left, right) => right.marketCapValueResolved - left.marketCapValueResolved),
      marketCapValue: sectorItems.reduce((sum, item) => sum + item.marketCapValueResolved, 0),
    }))
    .sort((left, right) => right.marketCapValue - left.marketCapValue || left.sector.localeCompare(right.sector));
}

function layoutTreemap<T>(entries: Array<{ item: T; value: number }>, rect: Rect): Array<{ item: T; rect: Rect }> {
  const cleanEntries = entries.filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
  const totalValue = cleanEntries.reduce((sum, entry) => sum + entry.value, 0);
  const totalArea = rect.width * rect.height;

  if (!cleanEntries.length || totalValue <= 0 || totalArea <= 0) return [];

  const pending = cleanEntries
    .map((entry) => ({
      item: entry.item,
      area: (entry.value / totalValue) * totalArea,
    }))
    .sort((left, right) => right.area - left.area);
  const result: Array<{ item: T; rect: Rect }> = [];
  let remaining = { ...rect };
  let row: Array<{ item: T; area: number }> = [];

  while (pending.length) {
    const next = pending[0];
    const side = Math.min(remaining.width, remaining.height);

    if (!row.length || worstAspectRatio([...row, next], side) <= worstAspectRatio(row, side)) {
      row.push(next);
      pending.shift();
      continue;
    }

    const laidOut = layoutTreemapRow(row, remaining);
    result.push(...laidOut.tiles);
    remaining = laidOut.remaining;
    row = [];
  }

  if (row.length) {
    result.push(...layoutTreemapRow(row, remaining).tiles);
  }

  return result.filter((tile) => tile.rect.width > 0 && tile.rect.height > 0);
}

function layoutTreemapRow<T>(row: Array<{ item: T; area: number }>, rect: Rect) {
  const area = row.reduce((sum, item) => sum + item.area, 0);

  if (rect.width >= rect.height) {
    const rowWidth = clampNumber(area / Math.max(rect.height, 1), 0, rect.width);
    let consumedHeight = 0;
    const tiles = row.map((entry, index) => {
      const height =
        index === row.length - 1 ? Math.max(0, rect.height - consumedHeight) : clampNumber(entry.area / Math.max(rowWidth, 1), 0, rect.height);
      const tile = {
        item: entry.item,
        rect: {
          x: rect.x,
          y: rect.y + consumedHeight,
          width: rowWidth,
          height,
        },
      };
      consumedHeight += height;
      return tile;
    });

    return {
      tiles,
      remaining: {
        x: rect.x + rowWidth,
        y: rect.y,
        width: Math.max(0, rect.width - rowWidth),
        height: rect.height,
      },
    };
  }

  const rowHeight = clampNumber(area / Math.max(rect.width, 1), 0, rect.height);
  let consumedWidth = 0;
  const tiles = row.map((entry, index) => {
    const width =
      index === row.length - 1 ? Math.max(0, rect.width - consumedWidth) : clampNumber(entry.area / Math.max(rowHeight, 1), 0, rect.width);
    const tile = {
      item: entry.item,
      rect: {
        x: rect.x + consumedWidth,
        y: rect.y,
        width,
        height: rowHeight,
      },
    };
    consumedWidth += width;
    return tile;
  });

  return {
    tiles,
    remaining: {
      x: rect.x,
      y: rect.y + rowHeight,
      width: rect.width,
      height: Math.max(0, rect.height - rowHeight),
    },
  };
}

function worstAspectRatio(row: Array<{ area: number }>, side: number) {
  if (!row.length || side <= 0) return Number.POSITIVE_INFINITY;

  const areas = row.map((item) => item.area).filter((area) => area > 0);
  const sum = areas.reduce((total, area) => total + area, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const sideSquared = side * side;

  if (!sum || !min || !sideSquared) return Number.POSITIVE_INFINITY;

  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function heatmapSectorHeaderHeight(rect: Rect, focused: boolean) {
  if (focused) return 32;
  if (rect.height < 42) return Math.max(12, rect.height * 0.32);
  return Math.min(26, Math.max(17, rect.height * 0.14));
}

function heatmapTileClass(rect: Rect, zoom: number) {
  const visualWidth = rect.width * zoom;
  const visualHeight = rect.height * zoom;
  const area = visualWidth * visualHeight;

  if (visualWidth < 34 || visualHeight < 22 || area < 520) return "pin";
  if (visualWidth < 58 || visualHeight < 34 || area < 1200) return "tiny";
  if (visualWidth < 95 || visualHeight < 58 || area < 3200) return "small";
  return "large";
}

function heatmapViewportFromView(view: HeatmapView): Rect {
  const safeView = clampHeatmapView(view);

  return {
    x: safeView.x,
    y: safeView.y,
    width: HEATMAP_WIDTH / safeView.zoom,
    height: HEATMAP_HEIGHT / safeView.zoom,
  };
}

function zoomHeatmapView(view: HeatmapView, pointerX: number, pointerY: number, deltaY: number): HeatmapView {
  const currentView = clampHeatmapView(view);
  const nextZoom = clampNumber(
    currentView.zoom * Math.exp(-deltaY * HEATMAP_ZOOM_SENSITIVITY),
    HEATMAP_MIN_ZOOM,
    HEATMAP_MAX_ZOOM,
  );

  if (Math.abs(nextZoom - currentView.zoom) < 0.001) return currentView;

  const currentViewport = heatmapViewportFromView(currentView);
  const focusX = currentViewport.x + currentViewport.width * pointerX;
  const focusY = currentViewport.y + currentViewport.height * pointerY;
  const nextWidth = HEATMAP_WIDTH / nextZoom;
  const nextHeight = HEATMAP_HEIGHT / nextZoom;

  return clampHeatmapView({
    x: focusX - nextWidth * pointerX,
    y: focusY - nextHeight * pointerY,
    zoom: nextZoom,
  });
}

function panHeatmapView(view: HeatmapView, deltaX: number, deltaY: number, elementWidth: number, elementHeight: number): HeatmapView {
  const currentView = clampHeatmapView(view);
  if (currentView.zoom <= HEATMAP_MIN_ZOOM + 0.001) return currentView;

  const viewportWidth = HEATMAP_WIDTH / currentView.zoom;
  const viewportHeight = HEATMAP_HEIGHT / currentView.zoom;

  return clampHeatmapView({
    ...currentView,
    x: currentView.x - (deltaX / Math.max(elementWidth, 1)) * viewportWidth,
    y: currentView.y - (deltaY / Math.max(elementHeight, 1)) * viewportHeight,
  });
}

function clampHeatmapView(view: HeatmapView): HeatmapView {
  const zoom = clampNumber(view.zoom, HEATMAP_MIN_ZOOM, HEATMAP_MAX_ZOOM);
  const viewportWidth = HEATMAP_WIDTH / zoom;
  const viewportHeight = HEATMAP_HEIGHT / zoom;
  const x = zoom <= HEATMAP_MIN_ZOOM + 0.001 ? 0 : clampNumber(view.x, 0, HEATMAP_WIDTH - viewportWidth);
  const y = zoom <= HEATMAP_MIN_ZOOM + 0.001 ? 0 : clampNumber(view.y, 0, HEATMAP_HEIGHT - viewportHeight);

  return { x, y, zoom };
}

function normalizedWheelDelta(event: WheelEvent) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * HEATMAP_HEIGHT;
  return event.deltaY;
}

function rectToStyle(rect: Rect, containerWidth: number, containerHeight: number): CSSProperties {
  return {
    left: `${(rect.x / Math.max(containerWidth, 1)) * 100}%`,
    top: `${(rect.y / Math.max(containerHeight, 1)) * 100}%`,
    width: `${(rect.width / Math.max(containerWidth, 1)) * 100}%`,
    height: `${(rect.height / Math.max(containerHeight, 1)) * 100}%`,
  };
}

function rectToViewportStyle(rect: Rect, viewport: Rect): CSSProperties {
  return {
    left: `${((rect.x - viewport.x) / Math.max(viewport.width, 1)) * 100}%`,
    top: `${((rect.y - viewport.y) / Math.max(viewport.height, 1)) * 100}%`,
    width: `${(rect.width / Math.max(viewport.width, 1)) * 100}%`,
    height: `${(rect.height / Math.max(viewport.height, 1)) * 100}%`,
  };
}

function relativeRect(rect: Rect, parent: Rect): Rect {
  return {
    x: rect.x - parent.x,
    y: rect.y - parent.y,
    width: rect.width,
    height: rect.height,
  };
}

function insetRect(rect: Rect, gap: number): Rect {
  const inset = gap / 2;

  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(0, rect.width - gap),
    height: Math.max(0, rect.height - gap),
  };
}

function scoreColorStyle(score: number): CSSProperties {
  const backgroundColor = heatmapScoreColor(score);
  return {
    backgroundColor,
    color: heatmapTextColor(backgroundColor),
  };
}

function heatmapScoreColor(score: number) {
  const value = Number.isFinite(score) ? clampNumber(score, 0, 100) : 0;
  const bucketIndex = Math.min(HEATMAP_SCORE_COLORS.length - 1, Math.floor((value / 100) * HEATMAP_SCORE_COLORS.length));

  return HEATMAP_SCORE_COLORS[bucketIndex];
}

function heatmapTextColor(backgroundColor: string) {
  return relativeLuminance(backgroundColor) > 0.52 ? "#202124" : "#ffffff";
}

function resolveMarketCapValue(item: Sp500TopItem) {
  if (typeof item.marketCapValue === "number" && Number.isFinite(item.marketCapValue)) {
    return item.marketCapValue;
  }

  return parseCompactMarketCap(item.marketCap);
}

function parseCompactMarketCap(value?: string) {
  if (!value) return undefined;

  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const match = normalized.match(/^([\d.]+)([a-zA-Zа-яА-Я]*)$/u);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;

  const suffix = match[2].toLowerCase();
  if (suffix.startsWith("t") || suffix.includes("трл")) return amount * 1_000_000_000_000;
  if (suffix.startsWith("b") || suffix.includes("млрд")) return amount * 1_000_000_000;
  if (suffix.startsWith("m") || suffix.includes("млн")) return amount * 1_000_000;
  if (suffix.startsWith("k") || suffix.includes("тис")) return amount * 1_000;
  return amount;
}

function formatCompactNumber(value: number | undefined, language: Language) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat(localeForPage(language), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string, language: Language) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat(localeForPage(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function localeForPage(language: Language) {
  return language === "uk" ? "uk-UA" : "en-US";
}

function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "uk";
}

function isAbortError(value: unknown) {
  return value instanceof Error && value.name === "AbortError";
}

function isRetryableFailure(message: string) {
  return /429|too many requests|rate.?limit/i.test(message);
}

async function readJsonPayload<T extends { message?: string }>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(formatResponseError(response, fallbackMessage));
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(formatResponseError(response, fallbackMessage));
  }
}

function formatResponseError(response: Response, fallbackMessage: string) {
  return response.ok ? fallbackMessage : `${fallbackMessage} HTTP ${response.status}.`;
}

function readSp500ScanCache(constituents: Sp500Constituent[], useSectorWeights: boolean) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SP500_SCAN_CACHE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredSp500Scan) : undefined;
    if (!parsed || parsed.expiresAt <= Date.now() || !parsed.modes || typeof parsed.modes !== "object") {
      window.localStorage.removeItem(SP500_SCAN_CACHE_STORAGE_KEY);
      return [];
    }

    const mode = parsed.modes[sp500ScanMode(useSectorWeights)];
    if (!Array.isArray(mode?.items)) {
      return [];
    }

    const metaBySymbol = new Map(constituents.map((constituent) => [constituent.symbol, constituent]));
    const restored = mode.items
      .filter((item) => metaBySymbol.has(item.symbol))
      .map((item) => {
        const meta = metaBySymbol.get(item.symbol);
        return {
          ...item,
          name: item.name || meta?.name || item.symbol,
          sector: item.sector ?? meta?.sector,
          industry: item.industry ?? meta?.industry,
        };
      });

    return Array.from(new Map(restored.map((item) => [item.symbol, item])).values());
  } catch {
    return [];
  }
}

function writeSp500ScanCache(items: Sp500TopItem[], useSectorWeights: boolean) {
  if (typeof window === "undefined") return;

  const uniqueItems = Array.from(new Map(items.map((item) => [item.symbol, item])).values());
  const current = readStoredSp500Scan();
  const payload: StoredSp500Scan = {
    expiresAt: Math.max(current?.expiresAt ?? 0, Date.now() + SP500_SCAN_CACHE_TTL_MS),
    modes: {
      ...(current?.modes ?? {}),
      [sp500ScanMode(useSectorWeights)]: {
        items: uniqueItems,
      },
    },
  };

  window.localStorage.setItem(SP500_SCAN_CACHE_STORAGE_KEY, JSON.stringify(payload));
}

function removeSp500ScanCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SP500_SCAN_CACHE_STORAGE_KEY);
}

function readStoredSp500Scan(): StoredSp500Scan | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(SP500_SCAN_CACHE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredSp500Scan) : undefined;
    if (!parsed || parsed.expiresAt <= Date.now() || !parsed.modes || typeof parsed.modes !== "object") {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function sp500ScanMode(useSectorWeights: boolean): Sp500ScanMode {
  return useSectorWeights ? "sectorWeights" : "baselineWeights";
}
