"use client";

import "./score-explanation.css";

import { useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Info,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type {
  AnalysisResult,
  IndicatorResult,
  MetricTone,
} from "@/lib/analysis-types";
import { localeForLanguage, uiCopy, type Language } from "@/lib/i18n";
import { indicatorExplanations, scoringCopy } from "@/lib/scoring-copy";
import { TextWithActualPeersLink } from "@/lib/actual-peers-link";

const icons = {
  double: TrendingUp,
  valuation: BadgeDollarSign,
  growth: BarChart3,
  margins: ShieldCheck,
  peg: Calculator,
};

export function ScoreExplanation({
  analysis,
  language,
}: {
  analysis: AnalysisResult;
  language: Language;
}) {
  const t = scoringCopy[language];
  const number = (value: number) =>
    new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits: 1,
    }).format(value);
  const deduction = (value: number) => `${value > 0 ? "−" : ""}${number(value)}`;
  const totalWeight =
    analysis.indicators.reduce((sum, indicator) => sum + indicator.weight, 0) ||
    1;
  const components = analysis.indicators.map((indicator) => ({
    indicator,
    weight: indicator.weight / totalWeight,
    contribution: (indicator.score * indicator.weight) / totalWeight,
    gap: ((100 - indicator.score) * indicator.weight) / totalWeight,
  }));
  const largestContribution = [...components].sort(
    (a, b) => b.contribution - a.contribution,
  )[0];
  const largestGap = [...components].sort((a, b) => b.gap - a.gap)[0];
  const largestWeight = Math.max(
    ...components.map((component) => component.weight),
    0.01,
  );
  const detailRefs = useRef<
    Partial<Record<IndicatorResult["id"], HTMLDetailsElement | null>>
  >({});
  const methodologyRef = useRef<HTMLDetailsElement>(null);
  const risk = analysis.riskBreakdown;

  function openIndicator(id: IndicatorResult["id"]) {
    const detail = detailRefs.current[id];
    if (!detail) return;
    detail.open = true;
    detail.querySelector("summary")?.focus({ preventScroll: true });
    detail.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <section
      className="scoreExplanation"
      aria-labelledby="score-explanation-title"
    >
      <div className="explanationHeading">
        <div>
          <span className="explanationEyebrow">
            Q-GARP / {analysis.scoringProfile}
          </span>
          <h2 id="score-explanation-title">{t.title}</h2>
          <p>{t.intro}</p>
        </div>
        <a
          className="methodologyLink"
          href="#scoring-methodology"
          onClick={() => {
            if (methodologyRef.current) methodologyRef.current.open = true;
          }}
        >
          <Info size={16} />
          {t.methodology}
        </a>
      </div>

      <div
        className="scoreEquation"
        aria-label={`${t.raw}: ${analysis.rawScore}; ${t.penalty}: −${analysis.riskPenalty}; ${t.final}: ${analysis.score}`}
      >
        <div>
          <span>{t.raw}</span>
          <strong>
            {analysis.rawScore}
            <small>/ 100</small>
          </strong>
        </div>
        <span className="equationOperator" aria-hidden="true">
          −
        </span>
        <div className={analysis.riskPenalty ? "equationPenalty" : ""}>
          <span>{t.penalty}</span>
          <strong>
            {analysis.riskPenalty}
            <small>{t.points}</small>
          </strong>
        </div>
        <span className="equationOperator" aria-hidden="true">
          =
        </span>
        <div className={`equationFinal scoreTone-${analysis.tone}`}>
          <span>{t.final}</span>
          <strong>
            {analysis.score}
            <small>/ 100</small>
          </strong>
        </div>
      </div>
      {analysis.rawScore < analysis.riskPenalty ? (
        <p className="explanationNote">{t.floor}</p>
      ) : null}

      <div className="scoreInsights">
        {largestContribution ? (
          <button
            className={`scoreInsight scoreTone-${largestContribution.indicator.tone}`}
            type="button"
            onClick={() => openIndicator(largestContribution.indicator.id)}
          >
            <ArrowUpRight size={21} aria-hidden="true" />
            <span>
              <small>{t.support}</small>
              <strong>{largestContribution.indicator.title}</strong>
            </span>
            <b>
              +{number(largestContribution.contribution)}
              <small>{t.points}</small>
            </b>
          </button>
        ) : null}
        {largestGap && largestGap.gap > 0 ? (
          <button
            className="scoreInsight scoreGapInsight"
            type="button"
            onClick={() => openIndicator(largestGap.indicator.id)}
          >
            <ArrowDownRight size={21} aria-hidden="true" />
            <span>
              <small>{t.drag}</small>
              <strong>{largestGap.indicator.title}</strong>
            </span>
            <b>
              {number(largestGap.gap)}
              <small>{t.points}</small>
            </b>
          </button>
        ) : null}
        <div className="scoreInsight coverageInsight">
          <ShieldCheck size={21} aria-hidden="true" />
          <span>
            <small>{t.confidence}</small>
            <strong>{analysis.confidence}%</strong>
          </span>
          <div
            className="coverageMeter"
            role="meter"
            aria-label={t.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={analysis.confidence}
          >
            <span style={{ width: `${analysis.confidence}%` }} />
          </div>
        </div>
      </div>

      <div className="contributionLegend">
        <span>
          <i className="legendEarned" />
          {t.earned}
        </span>
        <span>
          <i className="legendGap" />
          {t.gap}
        </span>
      </div>
      <p className="explanationNote">
        {t.gapHelp} {t.openHint}
      </p>

      <div className="scoreComponents">
        {components.map(({ indicator, weight, contribution, gap }) => (
          <details
            className={`scoreComponent scoreTone-${indicator.tone}`}
            id={`indicator-${indicator.id}`}
            key={`${analysis.symbol}-${indicator.id}-${language}`}
            ref={(node) => {
              detailRefs.current[indicator.id] = node;
            }}
          >
            <summary>
              <span className="componentIcon">
                {(() => {
                  const Icon = icons[indicator.id];
                  return <Icon size={20} />;
                })()}
              </span>
              <span className="componentName">
                <strong>{indicator.title}</strong>
                <small>{indicator.verdict}</small>
              </span>
              <span className="componentRating">
                <b>
                  {indicator.score}
                  <small>/100</small>
                </b>
                <span>{uiCopy[language].scoreLabels[indicator.tone]}</span>
              </span>
              <span className="componentContribution">
                <span className="componentPoints">
                  <strong>
                    +{number(contribution)}{" "}
                    <small>
                      {t.of} {number(weight * 100)} {t.points}
                    </small>
                  </strong>
                  <small>
                    {t.weight} {number(weight * 100)}%
                  </small>
                </span>
                <span
                  className="contributionTrack"
                  style={{ width: `${(weight / largestWeight) * 100}%` }}
                  aria-hidden="true"
                >
                  <span style={{ width: `${indicator.score}%` }} />
                </span>
                <small>
                  {t.gap}: {number(gap)} {t.points}
                </small>
              </span>
              <ChevronDown
                className="componentChevron"
                size={19}
                aria-hidden="true"
              />
            </summary>
            <IndicatorDetails
              indicator={indicator}
              language={language}
              weight={weight}
              contribution={contribution}
            />
          </details>
        ))}
      </div>
      <p className="explanationNote contributionRounding">{t.rounding}</p>

      <div className="riskAndCoverage">
        <section
          className="riskExplanation"
          aria-labelledby="risk-explanation-title"
        >
          <div className="riskHeading">
            <CircleAlert size={20} />
            <h3 id="risk-explanation-title">{t.riskTitle}</h3>
            <strong className={analysis.riskPenalty ? "riskDeduction" : ""}>
              {deduction(analysis.riskPenalty)} {t.points}
            </strong>
          </div>
          <p>{t.riskHelp}</p>
          {risk ? (
            <>
              {risk.items.length ? (
                <ul className="riskItems">
                  {risk.items.map((item) => (
                    <li key={item.label}>
                      <span>
                        <TextWithActualPeersLink
                          href={analysis.actualPeersSourceUrl}
                          text={item.label}
                        />
                      </span>
                      <b>
                        −{item.points} {t.points}
                      </b>
                    </li>
                  ))}
                </ul>
              ) : !analysis.riskPenalty ? (
                <p className="noRiskMessage">
                  <CheckCircle2 size={17} />
                  {t.noRisks}
                </p>
              ) : null}
              <dl className="riskTotals">
                <div>
                  <dt>
                    {t.explicitRisks} <small>(max 26)</small>
                  </dt>
                  <dd>{deduction(risk.explicitPenalty)}</dd>
                </div>
                <div>
                  <dt>{t.confidencePenalty}</dt>
                  <dd>{deduction(risk.confidencePenalty)}</dd>
                </div>
                <div>
                  <dt>
                    {t.totalPenalty} <small>(max 30)</small>
                  </dt>
                  <dd>
                    {deduction(analysis.riskPenalty)} {t.points}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <ul className="riskItems">
                {analysis.riskFlags.map((flag) => (
                  <li key={flag}>
                    <TextWithActualPeersLink
                      href={analysis.actualPeersSourceUrl}
                      text={flag}
                    />
                  </li>
                ))}
              </ul>
              <p>{t.legacy}</p>
            </>
          )}
          <p className="explanationNote">{t.caps}</p>
        </section>

        <aside className="dataExplanation">
          <ShieldCheck size={22} />
          <h3>
            {t.confidence} <strong>{analysis.confidence}%</strong>
          </h3>
          <p>{t.confidenceHelp}</p>
          <p>{t.confidenceRule}</p>
          <div className="coverageRows">
            {components.map(({ indicator }) => (
              <div key={indicator.id}>
                <span>{indicator.title}</span>
                <b>{indicator.confidence}%</b>
                <span className="coverageRowTrack" aria-hidden="true">
                  <i style={{ width: `${indicator.confidence}%` }} />
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <details
        className="scoringMethodology"
        id="scoring-methodology"
        ref={methodologyRef}
      >
        <summary>
          <Info size={18} />
          <h3>{t.methodology}</h3>
          <ChevronDown size={18} />
        </summary>
        <p>{t.methodologyIntro}</p>
        <div className="scoreScale">
          <span>{t.scaleBad}</span>
          <span>{t.scaleWatch}</span>
          <span>{t.scaleGood}</span>
        </div>
        <p>{t.scaleHelp}</p>
        <p>
          <strong>{analysis.scoringProfile}.</strong> {t.profiles}{" "}
          {analysis.sectorWeightsEnabled ? t.sectorOn : t.sectorOff}
        </p>
        <p>{t.calculationHelp}</p>
        <p>
          {t.missingCritical} {t.missingRegular}
        </p>
      </details>
    </section>
  );
}

function IndicatorDetails({
  indicator,
  language,
  weight,
  contribution,
}: {
  indicator: IndicatorResult;
  language: Language;
  weight: number;
  contribution: number;
}) {
  const [weakOnly, setWeakOnly] = useState(false);
  const t = scoringCopy[language];
  const number = (value: number) =>
    new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits: 1,
    }).format(value);
  const signals = indicator.signals ?? [];
  const visibleSignals = weakOnly
    ? signals.filter((signal) => !signal.observed || signal.score < 45)
    : signals;

  return (
    <div className="componentDetails">
      <p className="componentExplanation">
        {indicatorExplanations[language][indicator.id]}
      </p>
      <div className="componentFormula">
        <Calculator size={17} />
        <strong>
          {indicator.score}/100 × {number(weight * 100)} ={" "}
          {number(contribution)} {t.points}
        </strong>
        <span>{t.contribution}</span>
      </div>
      {indicator.confidence < 100 ? (
        <p className="componentDataWarning">
          <Info size={16} />
          {t.coverageWarning} {t.confidence}: {indicator.confidence}%.
        </p>
      ) : null}
      {signals.length ? (
        <>
          <div className="signalToolbar">
            <h4>{t.calculation}</h4>
            <div
              className="signalFilters"
              role="group"
              aria-label={t.calculation}
            >
              <button
                type="button"
                aria-pressed={!weakOnly}
                onClick={() => setWeakOnly(false)}
              >
                {t.allSignals} <span>{signals.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={weakOnly}
                onClick={() => setWeakOnly(true)}
              >
                {t.weakSignals}{" "}
                <span>
                  {
                    signals.filter(
                      (signal) => !signal.observed || signal.score < 45,
                    ).length
                  }
                </span>
              </button>
            </div>
          </div>
          <div className="signalTableWrap">
            <table className="signalTable">
              <caption>{t.calculationHelp}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.signal}</th>
                  <th scope="col">{t.value}</th>
                  <th scope="col">{t.score}</th>
                  <th scope="col">{t.signalWeight}</th>
                  <th scope="col">{t.signalPoints}</th>
                </tr>
              </thead>
              <tbody>
                {visibleSignals.map((signal) => {
                  const tone: MetricTone = !signal.observed
                    ? "unknown"
                    : signal.score >= 70
                      ? "good"
                      : signal.score >= 45
                        ? "watch"
                        : "bad";
                  return (
                    <tr
                      key={signal.label}
                      className={`signalRow scoreTone-${tone}`}
                    >
                      <th scope="row">
                        <strong>{signal.label}</strong>
                        <p>{signal.rule}</p>
                        {!signal.observed ? (
                          <p className="missingSignalNote">
                            {signal.critical
                              ? t.missingCritical
                              : t.missingRegular}
                          </p>
                        ) : null}
                      </th>
                      <td data-label={t.value}>{signal.value}</td>
                      <td data-label={t.score}>
                        <b>
                          {number(signal.score)}
                          <small>/100</small>
                        </b>
                        <span className="signalStatus">
                          {!signal.observed
                            ? t.missing
                            : tone === "good"
                              ? t.positive
                              : tone === "bad"
                                ? t.negative
                                : t.mixed}
                        </span>
                      </td>
                      <td data-label={t.signalWeight}>
                        {number(signal.weight * 100)}%
                      </td>
                      <td data-label={t.signalPoints}>
                        <strong>+{number(signal.score * signal.weight)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visibleSignals.length ? (
            <p className="noWeakSignals">{t.noWeakSignals}</p>
          ) : null}
        </>
      ) : (
        <p className="explanationNote">{t.legacy}</p>
      )}
      <details className="evidenceDetails">
        <summary>
          {t.context}
          <ChevronDown size={16} />
        </summary>
        <dl>
          {indicator.evidence.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
