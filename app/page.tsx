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
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AnalysisResult, IndicatorResult, MetricTone } from "@/lib/analysis-types";
import { termDefinitions, termForLabel, type TermKey } from "@/lib/term-definitions";

const metricIcons = {
  double: TrendingUp,
  valuation: BadgeDollarSign,
  growth: BarChart3,
  margins: ShieldCheck,
  peg: Calculator,
} satisfies Record<IndicatorResult["id"], typeof TrendingUp>;

const toneLabels: Record<MetricTone, string> = {
  good: "Так",
  watch: "Під питанням",
  bad: "Ні",
  unknown: "Даних замало",
};

const toneIcons = {
  good: CheckCircle2,
  watch: CircleAlert,
  bad: XCircle,
  unknown: AlertTriangle,
} satisfies Record<MetricTone, typeof CheckCircle2>;

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [lastTicker, setLastTicker] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const asOf = analysis?.asOf
    ? new Intl.DateTimeFormat("uk-UA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(analysis.asOf))
    : "";

  const loadAnalysis = useCallback(async (nextTicker: string, peerOverride?: string[] | null) => {
    const cleanTicker = nextTicker.trim();
    if (!cleanTicker) return;
    const peers = peerOverride === undefined ? readSavedPeerGroup(cleanTicker) : (peerOverride ?? []);
    const params = new URLSearchParams({ ticker: cleanTicker });
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
        throw new Error(payload.message ?? "Не вдалося отримати дані.");
      }
      setAnalysis(payload);
      setPeerInput(payload.peerSymbols?.join(", ") ?? "");
      setPromptCopied(false);
      setLastTicker(cleanTicker.toUpperCase());
    } catch (caught) {
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : "Не вдалося отримати дані.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTicker = new URLSearchParams(window.location.search).get("ticker");
    if (!initialTicker) return;

    const cleanTicker = initialTicker.toUpperCase();
    const timer = window.setTimeout(() => {
      setTicker(cleanTicker);
      void loadAnalysis(cleanTicker);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalysis]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAnalysis(ticker);
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

    await copyToClipboard(buildPeerSelectionPrompt(analysis));
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
            <h1>Q-GARP Framework - Taras Guk checklist</h1>
            <p>Чеклист якісного зростання за розумною ціною</p>
          </div>
        </div>

        <form className="searchForm" onSubmit={onSubmit}>
          <input
            className="tickerInput"
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder="AAPL"
            aria-label="Тікер"
            maxLength={16}
          />
          <button className="primaryButton" disabled={loading || !ticker.trim()} title="Оцінити" type="submit">
            {loading ? <Loader2 className="spinning" size={18} /> : <Search size={18} />}
            <span>Оцінити</span>
          </button>
          <button
            className="iconButton secondaryButton"
            disabled={loading || !lastTicker}
            title="Оновити"
            type="button"
            onClick={() => void loadAnalysis(lastTicker)}
          >
            <RefreshCw size={18} />
          </button>
        </form>
      </header>

      {analysis ? (
        <>
          <section className="summaryBand" aria-label="Підсумок">
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
              <Fact label="Ціна" value={analysis.price} />
              <Fact label="Капіталізація" value={analysis.marketCap} termKey="marketCap" />
              <Fact label="Сектор" value={analysis.sector ?? analysis.industry} />
              <Fact label="Оновлено" value={asOf} />
            </div>
          </section>

          <div className="statusRow">
            <span className="miniChip">
              <BadgeDollarSign size={15} />
              {analysis.currency ?? "валюта н/д"}
            </span>
            <span className="miniChip">
              <BarChart3 size={15} />
              <TermLabel label="Peers" termKey="peers" />: {analysis.peerSymbols.length ? analysis.peerSymbols.join(", ") : "н/д"}
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
                {analysis.peerSource === "manual" ? "Peer-група" : "Yahoo peer-група"}
              </span>
              <p>
                {analysis.peerSource === "manual"
                  ? "Порівняння росту рахується по медіані вибраних конкурентів і збережене локально для цього тікера."
                  : "Рекомендована група Yahoo - лише базове наближення. Для якіснішої оцінки краще вибрати прямих конкурентів вручну."}
              </p>
              {analysis.recommendedPeerSymbols.length ? (
                <small>Рекомендовані: {analysis.recommendedPeerSymbols.join(", ")}</small>
              ) : null}
            </div>

            <div className="peerControls">
              <input
                className="peerInput"
                value={peerInput}
                onChange={(event) => setPeerInput(event.target.value.toUpperCase())}
                placeholder="MSFT, GOOGL, AMZN"
                aria-label="Конкуренти"
              />
              <button
                className="peerButton"
                disabled={loading || !normalizePeerInput(peerInput, analysis.symbol).length}
                title="Застосувати peer-групу"
                type="button"
                onClick={applyPeerGroup}
              >
                <Save size={16} />
                <span>Застосувати</span>
              </button>
              <button
                className="peerButton prompt"
                disabled={loading}
                title="Скопіювати prompt для підбору конкурентів"
                type="button"
                onClick={() => void copyPeerPrompt()}
              >
                <ClipboardCopy size={16} />
                <span>{promptCopied ? "Скопійовано" : "Prompt"}</span>
              </button>
              <button
                className="peerButton reset"
                disabled={loading}
                title="Скинути на рекомендовані"
                type="button"
                onClick={resetPeerGroup}
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </div>
          </section>

          <section className="metricGrid" aria-label="Показники">
            {analysis.indicators.map((indicator) => (
              <MetricCard indicator={indicator} key={indicator.id} />
            ))}
          </section>

          <p className="finePrint">{analysis.dataNotes.join(" ")}</p>
        </>
      ) : loading ? (
        <StatePanel icon={<Loader2 size={34} />} title="Рахую показники" text="Фінзвітність, мультиплікатори, peer-група, SBC." type="loading" />
      ) : error ? (
        <StatePanel icon={<AlertTriangle size={34} />} title="Тікер не оброблено" text={error} type="error" />
      ) : (
        <StatePanel icon={<Search size={34} />} title="Тікер" text="Наприклад: AAPL, MSFT, NVDA, TSLA." type="empty" />
      )}
    </main>
  );
}

function Fact({ label, value, termKey }: { label: string; value?: string; termKey?: TermKey }) {
  return (
    <div className="fact">
      <span>
        <TermLabel label={label} termKey={termKey} />
      </span>
      <strong>{value ?? "н/д"}</strong>
    </div>
  );
}

function MetricCard({ indicator }: { indicator: IndicatorResult }) {
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
            <TermLabel label={indicator.title} termKey={termForLabel(indicator.title)} />
          </h3>
          <small>
            <TermLabel label={indicator.subtitle} termKey={termForLabel(indicator.subtitle)} />
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
              <TermLabel label={item.label} termKey={termForLabel(item.label)} />
            </span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>

      <div className="metricScore">
        <div className="scoreBar" aria-label={`Оцінка ${indicator.score} зі 100`}>
          <div
            className={`scoreFill ${fillClass}`}
            style={{ "--fill": `${Math.max(4, indicator.score)}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </article>
  );
}

function TermLabel({ label, termKey }: { label: string; termKey?: TermKey }) {
  const explanation = termKey ? termDefinitions[termKey] : undefined;

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

function buildPeerSelectionPrompt(analysis: AnalysisResult) {
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
