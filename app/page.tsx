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
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, IndicatorResult, MetricTone } from "@/lib/analysis-types";
import {
  defaultLanguage,
  languageLabels,
  localeForLanguage,
  normalizeLanguage,
  supportedLanguages,
  uiCopy,
  type Language,
} from "@/lib/i18n";
import { termDefinitions, termForLabel, type TermKey } from "@/lib/term-definitions";

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

const LANGUAGE_STORAGE_KEY = "invest-rate.language.v1";

export default function Home() {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [ticker, setTicker] = useState("");
  const [lastTicker, setLastTicker] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const didReadInitialUrl = useRef(false);
  const t = uiCopy[language];

  const asOf = analysis?.asOf
    ? new Intl.DateTimeFormat(localeForLanguage(language), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(analysis.asOf))
    : "";

  const loadAnalysis = useCallback(
    async (nextTicker: string, peerOverride?: string[] | null, requestLanguage = language) => {
      const cleanTicker = nextTicker.trim();
      if (!cleanTicker) return;
      const requestCopy = uiCopy[requestLanguage];
      const peers = peerOverride === undefined ? readSavedPeerGroup(cleanTicker) : (peerOverride ?? []);
      const params = new URLSearchParams({ ticker: cleanTicker, lang: requestLanguage });
      if (peers.length) {
        params.set("peers", peers.join(","));
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/analyze?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? requestCopy.errors.loadData);
        }
        setAnalysis(payload);
        setPeerInput(payload.peerSymbols?.join(", ") ?? "");
        setPromptCopied(false);
        setLastTicker(cleanTicker.toUpperCase());
      } catch (caught) {
        setAnalysis(null);
        setError(caught instanceof Error ? caught.message : requestCopy.errors.loadData);
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  useEffect(() => {
    if (didReadInitialUrl.current) return;
    didReadInitialUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const initialLanguage = normalizeLanguage(params.get("lang") ?? window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    const initialTicker = params.get("ticker");
    setLanguage(initialLanguage);
    document.documentElement.lang = initialLanguage;

    if (!initialTicker) return;

    const cleanTicker = initialTicker.toUpperCase();
    const timer = window.setTimeout(() => {
      setTicker(cleanTicker);
      void loadAnalysis(cleanTicker, undefined, initialLanguage);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalysis]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAnalysis(ticker);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;

    setLanguage(nextLanguage);
    const targetTicker = analysis?.symbol ?? lastTicker;
    if (targetTicker) {
      void loadAnalysis(targetTicker, undefined, nextLanguage);
      return;
    }

    setError("");
  }

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
      <header className="topBar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <BarChart3 size={23} />
          </div>
          <div className="brandText">
            <h1>{t.brandTitle}</h1>
            <p>{t.brandSubtitle}</p>
          </div>
        </div>

        <div className="topActions">
          <Link className="githubLink" href="/sp500-top" aria-label="S&P 500 Top">
            <BarChart3 size={17} />
            <span>S&P 500 Top</span>
          </Link>

          <a
            className="githubLink"
            href="https://github.com/Wlad1slav/Q-GARP-Framework"
            target="_blank"
            rel="noreferrer"
            aria-label="Wlad1slav/Q-GARP-Framework on GitHub"
          >
            <GitHubIcon size={17} />
            <span>Wlad1slav/Q-GARP-Framework</span>
          </a>

          <form className="searchForm" onSubmit={onSubmit}>
            <input
              className="tickerInput"
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="AAPL"
              aria-label={t.aria.ticker}
              maxLength={16}
            />
            <button className="primaryButton" disabled={loading || !ticker.trim()} title={t.actions.analyze} type="submit">
              {loading ? <Loader2 className="spinning" size={18} /> : <Search size={18} />}
              <span>{t.actions.analyze}</span>
            </button>
            <button
              className="iconButton secondaryButton"
              disabled={loading || !lastTicker}
              title={t.actions.refresh}
              type="button"
              onClick={() => void loadAnalysis(lastTicker)}
            >
              <RefreshCw size={18} />
            </button>
            <div className="languageToggle" role="group" aria-label={t.aria.language}>
              {supportedLanguages.map((nextLanguage) => (
                <button
                  aria-pressed={language === nextLanguage}
                  className={`languageOption ${language === nextLanguage ? "active" : ""}`}
                  disabled={loading && language !== nextLanguage}
                  key={nextLanguage}
                  type="button"
                  onClick={() => changeLanguage(nextLanguage)}
                >
                  {languageLabels[nextLanguage]}
                </button>
              ))}
            </div>
          </form>
        </div>
      </header>

      {analysis ? (
        <>
          <section className="summaryBand" aria-label={t.aria.summary}>
            <div className="scoreBlock">
              <div className="scoreRing" style={{ "--score": analysis.score } as React.CSSProperties}>
                <strong>{analysis.score}</strong>
              </div>
              <div className="scoreCopy">
                <h2>{analysis.label}</h2>
                <p>
                  {analysis.symbol} · {analysis.name}
                </p>
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
              <TermLabel label={t.peers.label} language={language} termKey="peers" />:{" "}
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
              <span className={`peerSourceBadge ${analysis.peerSource === "manual" ? "manual" : "recommended"}`}>
                <UsersRound size={15} />
                {analysis.peerSource === "manual" ? t.peers.manualBadge : t.peers.recommendedBadge}
              </span>
              <p>{analysis.peerSource === "manual" ? t.peers.manualText : t.peers.recommendedText}</p>
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

          <section className="metricGrid" aria-label={t.aria.metrics}>
            {analysis.indicators.map((indicator) => (
              <MetricCard
                indicator={indicator}
                key={indicator.id}
                language={language}
                scoreAria={t.aria.score}
                toneLabels={t.toneLabels}
              />
            ))}
          </section>

          <p className="finePrint">{analysis.dataNotes.join(" ")}</p>
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
  indicator,
  language,
  scoreAria,
  toneLabels,
}: {
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
            <TermLabel label={indicator.title} language={language} termKey={termForLabel(indicator.title)} />
          </h3>
          <small>
            <TermLabel label={indicator.subtitle} language={language} termKey={termForLabel(indicator.subtitle)} />
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
              <TermLabel label={item.label} language={language} termKey={termForLabel(item.label)} />
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

function TermLabel({ label, language, termKey }: { label: string; language: Language; termKey?: TermKey }) {
  const explanation = termKey ? termDefinitions[language][termKey] : undefined;

  if (!explanation) {
    return <>{label}</>;
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

function GitHubIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.66 7.66 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function buildPeerSelectionPrompt(analysis: AnalysisResult, language: Language) {
  if (language === "en") {
    const sector = analysis.sector ? `\nSector: ${analysis.sector}` : "";
    const industry = analysis.industry ? `\nIndustry: ${analysis.industry}` : "";
    const recommended = analysis.recommendedPeerSymbols.length
      ? `\nCurrent baseline Yahoo group: ${analysis.recommendedPeerSymbols.join(", ")}`
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
    ? `\nПоточна базова Yahoo-група: ${analysis.recommendedPeerSymbols.join(", ")}`
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

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(".", "-").slice(0, 16);
}

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
    const raw = window.localStorage.getItem(PEER_STORAGE_KEY);
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
  window.localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(groups));
}

function removeSavedPeerGroup(ticker: string) {
  if (typeof window === "undefined") return;

  const symbol = normalizeTicker(ticker);
  if (!symbol) return;

  const groups = readPeerGroups();
  delete groups[symbol];
  window.localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(groups));
}
