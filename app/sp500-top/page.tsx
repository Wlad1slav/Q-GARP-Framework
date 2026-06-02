"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MetricTone } from "@/lib/analysis-types";
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
const BATCH_SIZE = 10;
const TOP_COUNT = 10;

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
      "Оцінки в топі рахуються тією ж дефолтною методологією, що й чекліст тікера, з Yahoo recommended peers. Локально збережені manual peers з однотікерової сторінки тут не застосовуються.",
    tableTitle: "Детальний рейтинг",
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
      "Top scores use the same default methodology as the ticker checklist, with Yahoo recommended peers. Browser-saved manual peers from the single-ticker page are not applied here.",
    tableTitle: "Detailed ranking",
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
  const abortRef = useRef<AbortController | null>(null);
  const shouldStopRef = useRef(false);
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
        const response = await fetch("/api/sp500-constituents", { cache: "no-store" });
        const payload = (await response.json()) as ConstituentsPayload;

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

  const constituentBySymbol = useMemo(
    () => new Map(constituents.map((constituent) => [constituent.symbol, constituent])),
    [constituents],
  );

  const topByIndicator = useMemo(() => {
    return Object.fromEntries(
      sp500IndicatorIds.map((id) => [id, rankItems(items, id, TOP_COUNT)]),
    ) as Record<Sp500IndicatorId, Sp500TopItem[]>;
  }, [items]);

  const rankedRows = useMemo(() => rankItems(items, selectedMetric, 100), [items, selectedMetric]);
  const progress = constituents.length ? Math.round((processedCount / constituents.length) * 100) : 0;
  const isComplete = constituents.length > 0 && processedCount >= constituents.length;
  const statusText = scanning ? t.scanning : isComplete ? t.complete : processedCount ? t.stopped : t.idle;

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
  }

  function stopScan() {
    shouldStopRef.current = true;
    setStopping(true);
    abortRef.current?.abort();
  }

  async function startScan(reset = false) {
    if (!constituents.length || scanning) return;

    if (reset) {
      itemMapRef.current = new Map();
      failedRef.current = [];
      processedRef.current = new Set();
      setItems([]);
      setFailed([]);
      setProcessedCount(0);
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
        const response = await fetch(`/api/sp500-top?tickers=${batch.map(encodeURIComponent).join(",")}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as Sp500TopResponse & { message?: string };

        if (!response.ok) {
          throw new Error(payload.message ?? t.errors.scan);
        }

        mergeBatch(payload, constituentBySymbol);
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
      processedRef.current.add(item.symbol);
    }

    failedRef.current = Array.from(failedBySymbol.values());
    setItems(Array.from(itemMapRef.current.values()));
    setFailed(failedRef.current);
    setProcessedCount(processedRef.current.size);
  }

  if (loadingConstituents) {
    return (
      <main className="appShell sp500Shell">
        <Sp500Header language={language} onLanguageChange={changeLanguage} />
        <StatePanel icon={<Loader2 size={34} />} title={t.loadingList} text={t.loadingListText} type="loading" />
      </main>
    );
  }

  if (error && !constituents.length) {
    return (
      <main className="appShell sp500Shell">
        <Sp500Header language={language} onLanguageChange={changeLanguage} />
        <StatePanel icon={<AlertTriangle size={34} />} title={t.failedListTitle} text={error} type="error" />
      </main>
    );
  }

  return (
    <main className="appShell sp500Shell">
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
          <div className="metricTabs" role="group" aria-label={t.tableTitle}>
            <button
              aria-pressed={selectedMetric === "score"}
              className={`metricTab ${selectedMetric === "score" ? "active" : ""}`}
              type="button"
              onClick={() => setSelectedMetric("score")}
            >
              {t.overall}
            </button>
            {sp500IndicatorIds.map((id) => (
              <button
                aria-pressed={selectedMetric === id}
                className={`metricTab ${selectedMetric === id ? "active" : ""}`}
                key={id}
                type="button"
                onClick={() => setSelectedMetric(id)}
              >
                {t.indicators[id].short}
              </button>
            ))}
          </div>
        </div>

        {items.length ? (
          <RankingTable items={rankedRows} language={language} metric={selectedMetric} />
        ) : (
          <div className="rankingEmpty">{t.noRows}</div>
        )}
      </section>
    </main>
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

function RankingTable({ items, language, metric }: { items: Sp500TopItem[]; language: Language; metric: MetricKey }) {
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
          {items.map((item, index) => (
            <RankingRow item={item} key={`${metric}-${item.symbol}`} language={language} metric={metric} rank={index + 1} />
          ))}
        </tbody>
      </table>
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
          <strong>{item.symbol}</strong>
          <span>{item.name}</span>
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

function rankItems(items: Sp500TopItem[], metric: MetricKey, limit: number) {
  return [...items]
    .sort((left, right) => {
      const scoreDelta = metricValue(right, metric) - metricValue(left, metric);
      if (scoreDelta) return scoreDelta;

      const confidenceDelta = metricConfidence(right, metric) - metricConfidence(left, metric);
      if (confidenceDelta) return confidenceDelta;

      return right.score - left.score || left.symbol.localeCompare(right.symbol);
    })
    .slice(0, limit);
}

function metricValue(item: Sp500TopItem, metric: MetricKey) {
  return metric === "score" ? item.score : (item.indicators[metric]?.score ?? 0);
}

function metricConfidence(item: Sp500TopItem, metric: MetricKey) {
  return metric === "score" ? item.confidence : (item.indicators[metric]?.confidence ?? 0);
}

function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "uk";
}

function isAbortError(value: unknown) {
  return value instanceof Error && value.name === "AbortError";
}
