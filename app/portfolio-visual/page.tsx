"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ImagePlus,
  Landmark,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { APP_LANGUAGE_CHANGE_EVENT, type AppLanguageChangeDetail } from "@/lib/app-events";
import { readBrowserStorageItem } from "@/lib/browser-storage";
import { companyLogoUrl } from "@/lib/company-logo";
import {
  defaultLanguage,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  type Language,
} from "@/lib/i18n";
import {
  parsePortfolioCsv,
  type ParsedPortfolio,
  type PortfolioImportSource,
} from "@/lib/portfolio-import";
import {
  PELOSI_ALLOCATION_SOURCE_URL,
  PELOSI_ANNUAL_DISCLOSURE_URL,
  PELOSI_PORTRAIT_PATH,
  PELOSI_PORTRAIT_SOURCE_URL,
  PELOSI_Q1_PTR_URL,
  PELOSI_Q2_2026_EXAMPLE,
  PELOSI_Q2_PTR_URL,
} from "@/lib/portfolio-examples";

type ResolvedPosition = {
  sourceSymbol: string;
  quoteSymbol: string;
  name: string;
  quantity: number;
  price?: number;
  currency: string;
  fxToBase: number;
  valueBase: number;
  live: boolean;
};

type QuoteResponse = {
  baseCurrency: string;
  positions: ResolvedPosition[];
  cashValueBase: number;
  asOf: string;
  message?: string;
};

type VisualSegment = {
  key: string;
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  kind: "position" | "other" | "cash";
  startAngle: number;
  endAngle: number;
};

type LabelLayout = {
  segment: VisualSegment;
  x: number;
  y: number;
  side: "left" | "right";
  angle: number;
};

const POSTER_WIDTH = 800;
const POSTER_HEIGHT = 1000;
const CHART_CENTER_X = 400;
const CHART_CENTER_Y = 575;
const CHART_OUTER_RADIUS = 202;
const CHART_INNER_RADIUS = 112;
const SEGMENT_COLORS = ["#121722", "#343b46", "#59616c", "#777e87", "#969ca4", "#b6bac0", "#d1d3d7", "#e2e3e5"];
const BASE_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD"];
const PORTFOLIO_VISUAL_URL = "https://q-garp.netlify.app/portfolio-visual";

const sourceLabels: Record<PortfolioImportSource, Record<Language, string>> = {
  yahoo: { uk: "Yahoo Finance", en: "Yahoo Finance" },
  revolut: { uk: "Revolut", en: "Revolut" },
  ibkr: { uk: "Interactive Brokers", en: "Interactive Brokers" },
  example: { uk: "Q2 2026 модель · публічні розкриття", en: "Q2 2026 model · public disclosures" },
};

const copy = {
  uk: {
    eyebrow: "Portfolio Visual",
    title: "Автогенерація портфеля",
    subtitle: "Завантажте CSV — отримайте готовий постер з алокацією, логотипами й вашим фото.",
    uploadTitle: "Перетягніть CSV сюди",
    uploadText: "або натисніть, щоб вибрати файл",
    formats: "Yahoo Portfolio · Revolut Stocks · IBKR Activity Statement / Flex Query",
    privacy: "Сам CSV не завантажується; сервер отримує лише витягнуті позиції та валюти, потрібні для оновлення котирувань.",
    detected: "Розпізнано",
    positions: "позицій",
    asOf: "дані на",
    settings: "Налаштування постера",
    portfolioName: "Назва",
    date: "Дата",
    currency: "Базова валюта",
    topCount: "Окремих позицій",
    centerImage: "Фото в центрі",
    chooseImage: "Додати фото",
    replaceImage: "Замінити",
    removeImage: "Видалити",
    refresh: "Оновити котирування",
    refreshing: "Оновлюю",
    downloadPng: "Завантажити PNG",
    downloadSvg: "SVG",
    exportError: "Не вдалося експортувати зображення.",
    importError: "Не вдалося прочитати CSV.",
    noDataTitle: "Постер з’явиться після імпорту",
    noDataText: "Можна завантажити один із трьох підтримуваних CSV-форматів.",
    chartSubtitle: "STOCK PORTFOLIO",
    byAllocation: "By allocation · as of",
    other: "OTHER",
    otherModeledHoldings: "Інші модельні позиції",
    cash: "CASH",
    holdings: "Алокація",
    holding: "Позиція",
    value: "Вартість",
    share: "Частка",
    source: "Джерело",
    current: "live",
    fallback: "із CSV",
    uploadAnother: "Інший CSV",
    ibkrHelp: "Для IBKR експортуйте CSV із секціями Open Positions і Cash Report.",
    exampleEyebrow: "Публічний приклад",
    exampleTitle: "Портфель Пелосі · Q2 2026",
    exampleText: "Модельна алокація: NVDA 43,5%, AMZN 7,9%, AVGO 7,2%, MSFT 6,9%, GOOGL 5,2%, cash 8,5%.",
    exampleAction: "Згенерувати приклад",
    disclosureBasisTitle: "Як побудовано цей приклад",
    disclosureBasisText: "Ваги відтворено з Q2 2026 інфографіки Investing Visuals і звірено з публічними формами. House disclosure не містить точних квартальних ваг: Q2 PTR підтверджує лише придбання 200 call-опціонів INTC та 200 call-опціонів UBER 29 травня. Усі операції позначені SP (spouse). Це стороння модель, а не офіційний портфель.",
    allocationSource: "Джерело алокації",
    annualDisclosure: "Annual 2025",
    q1Transactions: "Q1 PTR",
    q2Transactions: "Q2 PTR",
    portraitSource: "Джерело фото",
    estimate: "модель",
    modeledAllocation: "Q2 2026 · модельні ваги ≈100%",
    disclosureChartSubtitle: "STOCK PORTFOLIO",
    disclosureByAllocation: "Modeled allocation · as of",
    disclosurePosterSource: "SOURCE: INVESTING VISUALS EST. · U.S. HOUSE FILINGS",
  },
  en: {
    eyebrow: "Portfolio Visual",
    title: "Portfolio poster generator",
    subtitle: "Upload a CSV and get a polished allocation poster with logos and your portrait.",
    uploadTitle: "Drop a CSV here",
    uploadText: "or click to choose a file",
    formats: "Yahoo Portfolio · Revolut Stocks · IBKR Activity Statement / Flex Query",
    privacy: "The CSV itself is never uploaded; only extracted positions and currencies needed for quote refresh are sent.",
    detected: "Detected",
    positions: "positions",
    asOf: "as of",
    settings: "Poster settings",
    portfolioName: "Title",
    date: "Date",
    currency: "Base currency",
    topCount: "Named positions",
    centerImage: "Center portrait",
    chooseImage: "Add portrait",
    replaceImage: "Replace",
    removeImage: "Remove",
    refresh: "Refresh prices",
    refreshing: "Refreshing",
    downloadPng: "Download PNG",
    downloadSvg: "SVG",
    exportError: "Could not export the image.",
    importError: "Could not read the CSV.",
    noDataTitle: "Your poster will appear after import",
    noDataText: "Upload any of the three supported CSV formats to begin.",
    chartSubtitle: "STOCK PORTFOLIO",
    byAllocation: "By allocation · as of",
    other: "OTHER",
    otherModeledHoldings: "Other modeled holdings",
    cash: "CASH",
    holdings: "Allocation",
    holding: "Holding",
    value: "Value",
    share: "Share",
    source: "Source",
    current: "live",
    fallback: "from CSV",
    uploadAnother: "Another CSV",
    ibkrHelp: "For IBKR, export CSV with the Open Positions and Cash Report sections.",
    exampleEyebrow: "Public example",
    exampleTitle: "Pelosi portfolio · Q2 2026",
    exampleText: "Modeled allocation: NVDA 43.5%, AMZN 7.9%, AVGO 7.2%, MSFT 6.9%, GOOGL 5.2%, and 8.5% cash.",
    exampleAction: "Generate example",
    disclosureBasisTitle: "How this example is built",
    disclosureBasisText: "Weights reproduce Investing Visuals' Q2 2026 graphic and are cross-checked against public filings. House disclosures do not report exact quarterly weights: the Q2 PTR only confirms purchases of 200 INTC calls and 200 UBER calls on May 29. Every transaction is marked SP (spouse). This is a third-party model, not an official portfolio.",
    allocationSource: "Allocation source",
    annualDisclosure: "Annual 2025",
    q1Transactions: "Q1 PTR",
    q2Transactions: "Q2 PTR",
    portraitSource: "Portrait source",
    estimate: "model",
    modeledAllocation: "Q2 2026 · modeled weights ≈100%",
    disclosureChartSubtitle: "STOCK PORTFOLIO",
    disclosureByAllocation: "Modeled allocation · as of",
    disclosurePosterSource: "SOURCE: INVESTING VISUALS EST. · U.S. HOUSE FILINGS",
  },
} satisfies Record<Language, Record<string, string>>;

export default function PortfolioVisualPage() {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [parsed, setParsed] = useState<ParsedPortfolio | null>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("MY PORTFOLIO");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [topCount, setTopCount] = useState(6);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [resolvedPositions, setResolvedPositions] = useState<ResolvedPosition[]>([]);
  const [cashValue, setCashValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"png" | "svg" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const posterRef = useRef<SVGSVGElement>(null);
  const t = copy[language];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLanguage(normalizeLanguage(readBrowserStorageItem(LANGUAGE_STORAGE_KEY)));
    }, 0);

    function handleLanguageChange(event: Event) {
      const detail = (event as CustomEvent<AppLanguageChangeDetail>).detail;
      if (detail?.language) setLanguage(detail.language);
    }

    window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    if (!parsed) return;
    const currentPortfolio = parsed;
    const controller = new AbortController();
    let active = true;

    async function refresh() {
      setLoading(currentPortfolio.source !== "example");
      setError("");
      setResolvedPositions(fallbackPositions(currentPortfolio, baseCurrency));
      setCashValue(fallbackCashValue(currentPortfolio, baseCurrency));
      if (currentPortfolio.source === "example") return;

      try {
        const response = await fetch("/api/portfolio-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positions: currentPortfolio.positions,
            cash: currentPortfolio.cash,
            baseCurrency,
            source: currentPortfolio.source,
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as QuoteResponse;
        if (!response.ok) throw new Error(payload.message || t.importError);
        if (!active) return;
        setResolvedPositions(payload.positions);
        setCashValue(payload.cashValueBase);
      } catch (caught) {
        if (!active || controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : t.importError);
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    return () => {
      active = false;
      controller.abort();
    };
  }, [baseCurrency, parsed, t.importError]);

  const segments = useMemo(
    () => buildSegments(resolvedPositions, Math.max(0, cashValue), topCount, t.other, t.cash),
    [cashValue, resolvedPositions, t.cash, t.other, topCount],
  );
  const labelLayouts = useMemo(() => layoutLabels(segments), [segments]);
  const totalValue = segments.reduce((sum, segment) => sum + segment.value, 0);

  async function importFile(file?: File) {
    if (!file) return;
    setError("");

    try {
      const result = parsePortfolioCsv(await file.text());
      if (parsed?.source === "example") {
        if (avatar === PELOSI_PORTRAIT_PATH) setAvatar(null);
        if (title === "NANCY PELOSI") setTitle("MY PORTFOLIO");
        setTopCount(6);
      }
      setParsed(result);
      setFileName(file.name);
      setBaseCurrency(result.baseCurrency);
      setAsOf(result.asOf ?? new Date().toISOString().slice(0, 10));
      setResolvedPositions(fallbackPositions(result, result.baseCurrency));
      setCashValue(fallbackCashValue(result, result.baseCurrency));
    } catch (caught) {
      setParsed(null);
      setResolvedPositions([]);
      setCashValue(0);
      setError(caught instanceof Error ? caught.message : t.importError);
    }
  }

  function loadPelosiExample() {
    const example = {
      ...PELOSI_Q2_2026_EXAMPLE,
      positions: PELOSI_Q2_2026_EXAMPLE.positions.map((position) => ({ ...position })),
    };
    setError("");
    setParsed(example);
    setFileName(language === "uk" ? "Q2 2026 · модельна алокація" : "Q2 2026 · modeled allocation");
    setTitle("NANCY PELOSI");
    setAsOf(example.asOf ?? "2026-06-30");
    setBaseCurrency(example.baseCurrency);
    setTopCount(5);
    setAvatar(PELOSI_PORTRAIT_PATH);
    setResolvedPositions(fallbackPositions(example, example.baseCurrency));
    setCashValue(fallbackCashValue(example, example.baseCurrency));
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void importFile(event.dataTransfer.files[0]);
  }

  function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(language === "uk" ? "Фото має бути меншим за 8 MB." : "The portrait must be smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function handleCsvInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    void importFile(file);
  }

  async function downloadPoster(format: "png" | "svg") {
    if (!posterRef.current) return;
    setExporting(format);
    setError("");

    try {
      const svgText = await serializePoster(posterRef.current);
      const safeName = title.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").replace(/^-|-$/g, "") || "portfolio";

      if (format === "svg") {
        downloadBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), `${safeName}.svg`);
      } else {
        const blob = await svgToPng(svgText, POSTER_WIDTH * 2, POSTER_HEIGHT * 2);
        downloadBlob(blob, `${safeName}.png`);
      }
    } catch {
      setError(t.exportError);
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="appShell portfolioVisualShell">
      <section className="portfolioVisualHero">
        <div>
          <p>{t.subtitle}</p>
        </div>
      </section>

      {!parsed ? (
        <section className="portfolioEmptyGrid">
          <button
            className={`portfolioDropzone ${dragging ? "dragging" : ""}`}
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <span className="portfolioUploadIcon"><UploadCloud size={34} /></span>
            <strong>{t.uploadTitle}</strong>
            <span>{t.uploadText}</span>
            <small>{t.formats}</small>
          </button>
          <aside className="portfolioEmptyAside">
            <div className="portfolioExampleCard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Nancy Pelosi" src={PELOSI_PORTRAIT_PATH} />
              <div>
                <small>{t.exampleEyebrow}</small>
                <strong>{t.exampleTitle}</strong>
                <p>{t.exampleText}</p>
                <button type="button" onClick={loadPelosiExample}>
                  <Sparkles size={15} /> {t.exampleAction} <ArrowRight size={15} />
                </button>
                <a href={PELOSI_ALLOCATION_SOURCE_URL} target="_blank" rel="noreferrer">
                  {t.allocationSource} <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className="portfolioImportNotes">
              <div><FileSpreadsheet size={20} /><p><strong>3 CSV formats</strong><span>{t.formats}</span></p></div>
              <div><WalletCards size={20} /><p><strong>IBKR</strong><span>{t.ibkrHelp}</span></p></div>
              <div><Check size={20} /><p><strong>Privacy</strong><span>{t.privacy}</span></p></div>
            </div>
          </aside>
        </section>
      ) : (
        <>
          <section className="portfolioWorkspace">
            <aside className="portfolioControls">
              <div className="portfolioImportBadge">
                <span className="portfolioSourceIcon"><FileSpreadsheet size={19} /></span>
                <span>
                  <small>{t.detected}: {sourceLabels[parsed.source][language]}</small>
                  <strong>{fileName}</strong>
                  <small>{parsed.positions.length} {t.positions} · {t.asOf} {formatShortDate(parsed.asOf, language)}</small>
                </span>
                <button type="button" title={t.uploadAnother} aria-label={t.uploadAnother} onClick={() => fileInput.current?.click()}>
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="portfolioControlPanel">
                <h3>{t.settings}</h3>
                <label className="portfolioField">
                  <span>{t.portfolioName}</span>
                  <input value={title} maxLength={28} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <div className={`portfolioFieldRow ${parsed.source === "example" ? "single" : ""}`}>
                  <label className="portfolioField">
                    <span><CalendarDays size={14} /> {t.date}</span>
                    <input type="date" value={asOf} disabled={parsed.source === "example"} onChange={(event) => setAsOf(event.target.value)} />
                  </label>
                  {parsed.source !== "example" ? (
                    <label className="portfolioField">
                      <span>{t.currency}</span>
                      <select value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}>
                        {BASE_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <label className="portfolioField portfolioRangeField">
                  <span>{t.topCount}<strong>{topCount}</strong></span>
                  <input type="range" min="4" max="8" step="1" value={topCount} onChange={(event) => setTopCount(Number(event.target.value))} />
                </label>
                <div className="portfolioPortraitControl">
                  <span>{t.centerImage}</span>
                  <div>
                    <button type="button" className="portfolioSecondaryAction" onClick={() => avatarInput.current?.click()}>
                      <ImagePlus size={16} /> {avatar ? t.replaceImage : t.chooseImage}
                    </button>
                    {avatar ? (
                      <button type="button" className="portfolioIconAction" title={t.removeImage} aria-label={t.removeImage} onClick={() => setAvatar(null)}>
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
                {parsed.source !== "example" ? (
                  <button className="portfolioRefreshButton" type="button" disabled={loading} onClick={() => setParsed({ ...parsed })}>
                    {loading ? <Loader2 className="spinning" size={17} /> : <RefreshCw size={17} />}
                    {loading ? t.refreshing : t.refresh}
                  </button>
                ) : null}
              </div>

              {parsed.warnings.length ? (
                <div className="portfolioWarnings">
                  {parsed.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}

              {parsed.source === "example" ? (
                <div className="portfolioDisclosureNote">
                  <Landmark size={20} />
                  <div>
                    <strong>{t.disclosureBasisTitle}</strong>
                    <p>{t.disclosureBasisText}</p>
                    <span>
                      <a href={PELOSI_ALLOCATION_SOURCE_URL} target="_blank" rel="noreferrer">{t.allocationSource} <ExternalLink size={12} /></a>
                      <a href={PELOSI_ANNUAL_DISCLOSURE_URL} target="_blank" rel="noreferrer">{t.annualDisclosure} <ExternalLink size={12} /></a>
                      <a href={PELOSI_Q1_PTR_URL} target="_blank" rel="noreferrer">{t.q1Transactions} <ExternalLink size={12} /></a>
                      <a href={PELOSI_Q2_PTR_URL} target="_blank" rel="noreferrer">{t.q2Transactions} <ExternalLink size={12} /></a>
                      <a href={PELOSI_PORTRAIT_SOURCE_URL} target="_blank" rel="noreferrer">{t.portraitSource} <ExternalLink size={12} /></a>
                    </span>
                  </div>
                </div>
              ) : null}
            </aside>

            <section className="portfolioPosterColumn">
              <div className="portfolioPosterToolbar">
                <span>{parsed.source === "example" ? t.modeledAllocation : formatMoney(totalValue, baseCurrency, language)}</span>
                <div>
                  <button type="button" className="portfolioSecondaryAction" disabled={Boolean(exporting)} onClick={() => void downloadPoster("svg")}>
                    {exporting === "svg" ? <Loader2 className="spinning" size={16} /> : null}{t.downloadSvg}
                  </button>
                  <button type="button" className="portfolioDownloadButton" disabled={Boolean(exporting)} onClick={() => void downloadPoster("png")}>
                    {exporting === "png" ? <Loader2 className="spinning" size={17} /> : <Download size={17} />}{t.downloadPng}
                  </button>
                </div>
              </div>

              <div className="portfolioPosterFrame">
                <PortfolioPoster
                  avatar={avatar}
                  asOf={asOf}
                  asOfLabel={parsed.source === "example" ? "Q2 2026" : undefined}
                  labelLayouts={labelLayouts}
                  segments={segments}
                  subtitle={parsed.source === "example" ? t.disclosureChartSubtitle : t.chartSubtitle}
                  byAllocation={parsed.source === "example" ? t.disclosureByAllocation : t.byAllocation}
                  title={title || "MY PORTFOLIO"}
                  posterRef={posterRef}
                  sourceNote={parsed.source === "example" ? t.disclosurePosterSource : undefined}
                  sourceUrl={parsed.source === "example" ? PELOSI_ALLOCATION_SOURCE_URL : undefined}
                />
              </div>
            </section>
          </section>

          <AllocationTable
            baseCurrency={baseCurrency}
            cashValue={cashValue}
            language={language}
            positions={resolvedPositions}
            source={sourceLabels[parsed.source][language]}
            totalValue={totalValue}
            estimated={parsed.source === "example"}
          />
        </>
      )}

      {!parsed ? (
        <div className="portfolioPosterPlaceholder">
          <Sparkles size={26} />
          <strong>{t.noDataTitle}</strong>
          <span>{t.noDataText}</span>
        </div>
      ) : null}

      {error ? <p className="portfolioError" role="alert">{error}</p> : null}
      <input ref={fileInput} className="portfolioHiddenInput" type="file" accept=".csv,text/csv" onChange={handleCsvInput} />
      <input ref={avatarInput} className="portfolioHiddenInput" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} />
    </main>
  );
}

function PortfolioPoster({
  avatar,
  asOf,
  asOfLabel,
  byAllocation,
  labelLayouts,
  posterRef,
  segments,
  sourceNote,
  sourceUrl,
  subtitle,
  title,
}: {
  avatar: string | null;
  asOf: string;
  asOfLabel?: string;
  byAllocation: string;
  labelLayouts: LabelLayout[];
  posterRef: React.RefObject<SVGSVGElement | null>;
  segments: VisualSegment[];
  sourceNote?: string;
  sourceUrl?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <svg
      ref={posterRef}
      className="portfolioPosterSvg"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}`}
      role="img"
      aria-label={`${title} ${subtitle}`}
    >
      <defs>
        <filter id="paperTexture" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" seed="8" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="grayNoise" />
          <feComponentTransfer in="grayNoise" result="faintNoise"><feFuncA type="table" tableValues="0 0.055" /></feComponentTransfer>
          <feBlend in="SourceGraphic" in2="faintNoise" mode="multiply" />
        </filter>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0d1118" floodOpacity="0.16" />
        </filter>
        <clipPath id="portraitClip"><circle cx={CHART_CENTER_X} cy={CHART_CENTER_Y} r="95" /></clipPath>
        <clipPath id="siteLogoClip"><circle cx="400" cy="82" r="44" /></clipPath>
        <clipPath id="companyLogoClip" clipPathUnits="objectBoundingBox">
          <rect width="1" height="1" rx="0.22" />
        </clipPath>
      </defs>

      <rect width={POSTER_WIDTH} height={POSTER_HEIGHT} fill="#f3f1eb" />
      <rect width={POSTER_WIDTH} height={POSTER_HEIGHT} fill="#f8f7f3" filter="url(#paperTexture)" />
      <image href="/assets/logo.webp" x="356" y="38" width="88" height="88" preserveAspectRatio="xMidYMid slice" clipPath="url(#siteLogoClip)" />
      <text x="400" y="184" textAnchor="middle" fill="#10141b" fontFamily="Arial Black, Helvetica Neue, Arial, sans-serif" fontSize={title.length > 19 ? 47 : 55} fontWeight="900" letterSpacing="9">{title.toUpperCase()}</text>
      <line x1="82" y1="207" x2="718" y2="207" stroke="#d7483f" strokeWidth="3" />
      <line x1="82" y1="250" x2="222" y2="250" stroke="#1b2028" strokeWidth="3" />
      <line x1="578" y1="250" x2="718" y2="250" stroke="#1b2028" strokeWidth="3" />
      <text x="400" y="262" textAnchor="middle" fill="#171b22" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="29" fontWeight="800" letterSpacing="5">{subtitle}</text>
      <text x="400" y="302" textAnchor="middle" fill="#73777d" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="17" fontWeight="500" letterSpacing="4">{byAllocation} {asOfLabel ?? formatPosterDate(asOf)}</text>

      {segments.length ? segments.map((segment) => (
        <path
          d={donutPath(segment.startAngle, segment.endAngle)}
          fill={segment.color}
          key={segment.key}
          stroke="#f3f1eb"
          strokeWidth="1.4"
        />
      )) : (
        <circle cx={CHART_CENTER_X} cy={CHART_CENTER_Y} r={CHART_OUTER_RADIUS - 45} fill="none" stroke="#d6d5d1" strokeWidth="88" strokeDasharray="8 10" />
      )}

      {labelLayouts.map((layout) => <PosterLabel key={layout.segment.key} layout={layout} />)}

      <circle cx={CHART_CENTER_X} cy={CHART_CENTER_Y} r="101" fill="#f8f7f3" filter="url(#softShadow)" />
      {avatar ? (
        <image href={avatar} x={CHART_CENTER_X - 95} y={CHART_CENTER_Y - 95} width="190" height="190" preserveAspectRatio="xMidYMid slice" clipPath="url(#portraitClip)" />
      ) : (
        <g transform={`translate(${CHART_CENTER_X} ${CHART_CENTER_Y})`}>
          <circle r="94" fill="#eceae4" />
          <path d="M-39 -28 L0 18 L39 -28 M-39 28 L0 -18 L39 28" fill="none" stroke="#171c25" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <text y="62" textAnchor="middle" fill="#656a72" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="800" letterSpacing="2">Q-GARP</text>
        </g>
      )}
      <circle cx={CHART_CENTER_X} cy={CHART_CENTER_Y} r="101" fill="none" stroke="#f8f7f3" strokeWidth="8" />

      {sourceNote ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          <text x="400" y="928" textAnchor="middle" fill="#4f555d" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="11" fontWeight="700" letterSpacing="1.1">{sourceNote}</text>
        </a>
      ) : null}
      <a href={PORTFOLIO_VISUAL_URL} target="_blank" rel="noreferrer">
        <text x="400" y="960" textAnchor="middle" fill="#4f555d" opacity="0.56" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="12" fontWeight="600" letterSpacing="0.7">q-garp.netlify.app/portfolio-visual</text>
      </a>
    </svg>
  );
}

function PosterLabel({ layout }: { layout: LabelLayout }) {
  const { angle, segment, side, x, y } = layout;
  const ringPoint = polarPoint(CHART_OUTER_RADIUS + 4, angle);
  const elbowX = side === "right" ? x - 13 : x + 13;
  const textX = side === "right" ? x + 53 : x - 53;
  const logoX = side === "right" ? x : x - 44;

  return (
    <g>
      <path
        d={`M ${ringPoint.x} ${ringPoint.y} L ${elbowX} ${y} L ${side === "right" ? x - 4 : x + 4} ${y}`}
        fill="none"
        stroke="#a6a7a6"
        strokeWidth="1.25"
      />
      {segment.kind === "position" ? (
        <image
          href={companyLogoUrl(segment.symbol)}
          x={logoX - 3}
          y={y - 25}
          width="50"
          height="50"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#companyLogoClip)"
        />
      ) : segment.kind === "cash" ? (
        <g transform={`translate(${logoX} ${y - 22})`}>
          <rect width="44" height="44" rx="12" fill="#282d35" />
          <path d="M14 12 C14 8 30 8 30 12 L34 19 C37 26 32 35 22 35 C12 35 7 26 10 19 Z" fill="#f6f4ef" />
          <text x="22" y="28" textAnchor="middle" fill="#282d35" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="900">$</text>
        </g>
      ) : (
        <g transform={`translate(${logoX} ${y - 22})`} fill="#444a53">
          <rect width="18" height="18" rx="4" /><rect x="23" width="18" height="18" rx="4" /><rect y="23" width="18" height="18" rx="4" /><path d="M23 30 L32 21 L42 31 L32 41 Z" />
        </g>
      )}
      <text x={textX} y={y - 2} textAnchor={side === "right" ? "start" : "end"} fill="#262b33" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="18" fontWeight="850">{segment.symbol}</text>
      <text x={textX} y={y + 20} textAnchor={side === "right" ? "start" : "end"} fill="#4e535b" fontFamily="Helvetica Neue, Arial, sans-serif" fontSize="17" fontWeight="700">{formatPercentage(segment.percentage)}</text>
    </g>
  );
}

function AllocationTable({
  baseCurrency,
  cashValue,
  language,
  positions,
  source,
  totalValue,
  estimated,
}: {
  baseCurrency: string;
  cashValue: number;
  estimated: boolean;
  language: Language;
  positions: ResolvedPosition[];
  source: string;
  totalValue: number;
}) {
  const t = copy[language];
  const rows = [...positions]
    .filter((position) => position.valueBase > 0.01)
    .sort((left, right) => right.valueBase - left.valueBase);

  return (
    <section className="portfolioAllocationPanel">
      <div className="portfolioAllocationHeader">
        <div><p>{t.holdings}</p><h3>{source}</h3></div>
        <strong>{estimated ? t.modeledAllocation : formatMoney(totalValue, baseCurrency, language)}</strong>
      </div>
      <div className="portfolioTableWrap">
        <table className="portfolioTable">
          <thead><tr><th>{t.holding}</th>{!estimated ? <th>{t.value}</th> : null}<th>{t.share}</th><th>{t.source}</th></tr></thead>
          <tbody>
            {rows.map((position) => (
              <tr key={position.sourceSymbol}>
                <td>
                  {position.sourceSymbol === "OTHER" ? (
                    <span className="portfolioTableAggregate" aria-hidden="true"><i /><i /><i /><i /></span>
                  ) : (
                    <span className="portfolioTableLogo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" loading="lazy" src={companyLogoUrl(position.sourceSymbol)} />
                    </span>
                  )}
                  <span><strong>{position.sourceSymbol}</strong><small>{position.sourceSymbol === "OTHER" ? t.otherModeledHoldings : position.name}</small></span>
                </td>
                {!estimated ? <td>{formatMoney(position.valueBase, baseCurrency, language)}</td> : null}
                <td>{formatPercentage(totalValue ? position.valueBase / totalValue * 100 : 0)}</td>
                <td><span className={`portfolioPriceStatus ${!estimated && position.live ? "live" : ""}`}>{estimated ? t.estimate : position.live ? t.current : t.fallback}</span></td>
              </tr>
            ))}
            {cashValue > 0.01 ? (
              <tr><td><span className="portfolioTableCash">$</span><span><strong>{t.cash}</strong><small>{baseCurrency}</small></span></td>{!estimated ? <td>{formatMoney(cashValue, baseCurrency, language)}</td> : null}<td>{formatPercentage(totalValue ? cashValue / totalValue * 100 : 0)}</td><td><span className="portfolioPriceStatus">{estimated ? t.estimate : "CSV"}</span></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fallbackPositions(parsed: ParsedPortfolio, baseCurrency: string): ResolvedPosition[] {
  return parsed.positions.map((position) => {
    const currency = position.currency || baseCurrency;
    const fxToBase = currency === baseCurrency ? 1 : position.fxToBase ?? 1;
    const value = Number.isFinite(position.reportedValue)
      ? (position.reportedValue as number) * fxToBase
      : position.quantity * (position.fallbackPrice ?? 0) * fxToBase;

    return {
      sourceSymbol: position.symbol,
      quoteSymbol: position.symbol,
      name: position.name || position.symbol,
      quantity: position.quantity,
      price: position.fallbackPrice,
      currency,
      fxToBase,
      valueBase: value,
      live: false,
    };
  });
}

function fallbackCashValue(parsed: ParsedPortfolio, baseCurrency: string) {
  return parsed.cash.reduce((sum, item) => sum + item.amount * (item.currency === baseCurrency ? 1 : item.fxToBase ?? 1), 0);
}

function buildSegments(positions: ResolvedPosition[], cashValue: number, topCount: number, otherLabel: string, cashLabel: string) {
  const positivePositions = positions
    .filter((position) => Number.isFinite(position.valueBase) && position.valueBase > 0.01)
    .sort((left, right) => right.valueBase - left.valueBase);
  const aggregateOtherValue = positivePositions
    .filter((position) => position.sourceSymbol === "OTHER")
    .reduce((sum, position) => sum + position.valueBase, 0);
  const individualPositions = positivePositions.filter((position) => position.sourceSymbol !== "OTHER");
  const named = individualPositions.slice(0, topCount);
  const otherValue = aggregateOtherValue + individualPositions.slice(topCount).reduce((sum, position) => sum + position.valueBase, 0);
  const rawSegments: Omit<VisualSegment, "percentage" | "startAngle" | "endAngle">[] = named.map((position, index) => ({
    key: position.sourceSymbol,
    symbol: position.sourceSymbol,
    name: position.name,
    value: position.valueBase,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    kind: "position",
  }));
  if (otherValue > 0.01) rawSegments.push({ key: "other", symbol: otherLabel, name: otherLabel, value: otherValue, color: "#b7b9bd", kind: "other" });
  if (cashValue > 0.01) rawSegments.push({ key: "cash", symbol: cashLabel, name: cashLabel, value: cashValue, color: "#dedfe1", kind: "cash" });

  const total = rawSegments.reduce((sum, segment) => sum + segment.value, 0);
  let angle = -90;
  return rawSegments.map((segment) => {
    const percentage = total ? segment.value / total * 100 : 0;
    const sweep = total ? segment.value / total * 360 : 0;
    const result = { ...segment, percentage, startAngle: angle, endAngle: angle + sweep };
    angle += sweep;
    return result;
  });
}

function layoutLabels(segments: VisualSegment[]): LabelLayout[] {
  const layouts: LabelLayout[] = segments.map((segment) => {
    const angle = (segment.startAngle + segment.endAngle) / 2;
    const radians = angle * Math.PI / 180;
    const side = Math.cos(radians) >= 0 ? "right" as const : "left" as const;
    return {
      segment,
      angle,
      side,
      x: side === "right" ? 658 : 142,
      y: CHART_CENTER_Y + Math.sin(radians) * 250,
    };
  });

  for (const side of ["left", "right"] as const) {
    const sideItems = layouts.filter((layout) => layout.side === side).sort((left, right) => left.y - right.y);
    const minY = 350;
    const maxY = 805;
    const gap = 69;
    sideItems.forEach((layout, index) => {
      layout.y = Math.max(layout.y, minY + index * gap);
    });
    for (let index = sideItems.length - 1; index >= 0; index -= 1) {
      const ceiling = maxY - (sideItems.length - 1 - index) * gap;
      sideItems[index].y = Math.min(sideItems[index].y, ceiling);
    }
  }

  return layouts;
}

function donutPath(startAngle: number, endAngle: number) {
  const safeEnd = Math.min(endAngle, startAngle + 359.999);
  const outerStart = polarPoint(CHART_OUTER_RADIUS, startAngle);
  const outerEnd = polarPoint(CHART_OUTER_RADIUS, safeEnd);
  const innerEnd = polarPoint(CHART_INNER_RADIUS, safeEnd);
  const innerStart = polarPoint(CHART_INNER_RADIUS, startAngle);
  const largeArc = safeEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${CHART_OUTER_RADIUS} ${CHART_OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${CHART_INNER_RADIUS} ${CHART_INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarPoint(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: CHART_CENTER_X + Math.cos(radians) * radius,
    y: CHART_CENTER_Y + Math.sin(radians) * radius,
  };
}

async function serializePoster(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(POSTER_WIDTH));
  clone.setAttribute("height", String(POSTER_HEIGHT));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const images = Array.from(clone.querySelectorAll("image"));

  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute("href") || image.getAttribute("xlink:href");
    if (!href || href.startsWith("data:")) return;
    try {
      const response = await fetch(new URL(href, window.location.href));
      if (!response.ok) return;
      image.setAttribute("href", await blobToDataUrl(await response.blob()));
    } catch {
      image.remove();
    }
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(clone)}`;
}

function svgToPng(svgText: string, width: number, height: number) {
  return new Promise<Blob>((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas is unavailable."));
        return;
      }
      context.fillStyle = "#f3f1eb";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG export failed.")), "image/png", 0.96);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG render failed.")); };
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image encoding failed."));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMoney(value: number, currency: string, language: Language) {
  return new Intl.NumberFormat(language === "uk" ? "uk-UA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercentage(value: number) {
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${value.toFixed(1)}%`;
}

function formatShortDate(value: string | undefined, language: Language) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`));
}

function formatPosterDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date).toUpperCase();
}
