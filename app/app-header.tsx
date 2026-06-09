"use client";

import { BarChart3, ExternalLink, Loader2, Menu, RefreshCw, Search, Settings, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  APP_SETTINGS_STORAGE_KEY,
  readAnalysisSettings,
  SECTOR_WEIGHTS_QUERY_PARAM,
  sectorWeightsSearchParam,
  writeAnalysisSettings,
  type AnalysisSettings,
  type SupplementalMetricSettings,
} from "@/lib/analysis-settings";
import { supplementalMetricIds, type SupplementalMetricId } from "@/lib/analysis-types";
import {
  APP_ANALYSIS_REQUEST_EVENT,
  APP_ANALYSIS_SETTINGS_CHANGE_EVENT,
  APP_ANALYSIS_STATUS_EVENT,
  APP_LANGUAGE_CHANGE_EVENT,
  type AppAnalysisStatusDetail,
} from "@/lib/app-events";
import {
  defaultLanguage,
  languageLabels,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  supportedLanguages,
  uiCopy,
  type Language,
} from "@/lib/i18n";
import { normalizeTicker } from "@/lib/ticker";

const METHODOLOGY_SCORING_PROFILES_URL =
  "https://github.com/Wlad1slav/Q-GARP-Framework/blob/main/METHODOLOGY.md";

const headerCopy = {
  uk: {
    menu: "Головне меню",
    sp500Top: "S&P 500 Top",
    methodology: "Методологія",
    github: "Wlad1slav / Q-GARP-Framework",
  },
  en: {
    menu: "Main menu",
    sp500Top: "S&P 500 Top",
    methodology: "Methodology",
    github: "Wlad1slav / Q-GARP-Framework",
  },
} satisfies Record<Language, { menu: string; sp500Top: string; methodology: string; github: string }>;

type HeaderCopy = (typeof headerCopy)[Language];

const settingsPanelCopy = {
  uk: {
    title: "Налаштування",
    sectorWeights: "Увімкнути ваги залежно від галузі",
    supplementalMetricsTitle: "Додаткові метрики стоку",
    methodologyTitle: "Методологія scoring profiles",
  },
  en: {
    title: "Settings",
    sectorWeights: "Enable industry-based weights",
    supplementalMetricsTitle: "Supplemental stock metrics",
    methodologyTitle: "Scoring profiles methodology",
  },
} satisfies Record<Language, { title: string; sectorWeights: string; supplementalMetricsTitle: string; methodologyTitle: string }>;

const supplementalMetricsCopy = {
  uk: {
    totalShareholderYield: "Total Shareholder Yield",
    fcfYield: "FCF yield",
    impliedUpside: "Implied upside",
    fiftyTwoWeekRangePosition: "Позиція в 52-тижневому діапазоні",
  },
  en: {
    totalShareholderYield: "Total Shareholder Yield",
    fcfYield: "FCF yield",
    impliedUpside: "Implied upside",
    fiftyTwoWeekRangePosition: "52-week range position",
  },
} satisfies Record<Language, Record<SupplementalMetricId, string>>;

export function AppHeader() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(readInitialHeaderLanguage);
  const [ticker, setTicker] = useState(readInitialHeaderTicker);
  const [lastTicker, setLastTicker] = useState(readInitialHeaderTicker);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useSectorWeights, setUseSectorWeights] = useState(() => readAnalysisSettings(APP_SETTINGS_STORAGE_KEY).useSectorWeights);
  const [supplementalMetricSettings, setSupplementalMetricSettings] = useState(
    () => readAnalysisSettings(APP_SETTINGS_STORAGE_KEY).supplementalMetrics,
  );
  const t = uiCopy[language];
  const header = headerCopy[language];
  const mobileMenuId = "app-mobile-menu";

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    function handleAnalysisStatus(event: Event) {
      const detail = (event as CustomEvent<AppAnalysisStatusDetail>).detail;
      setLoading(Boolean(detail?.loading));

      if (detail?.lastTicker) {
        setLastTicker(detail.lastTicker);
        setTicker(detail.lastTicker);
      }
    }

    window.addEventListener(APP_ANALYSIS_STATUS_EVENT, handleAnalysisStatus);
    return () => window.removeEventListener(APP_ANALYSIS_STATUS_EVENT, handleAnalysisStatus);
  }, []);

  function currentSettings(): AnalysisSettings {
    return {
      useSectorWeights,
      supplementalMetrics: supplementalMetricSettings,
    };
  }

  function submitTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestAnalysis(ticker);
  }

  function requestAnalysis(nextTicker: string) {
    const cleanTicker = normalizeTicker(nextTicker);
    if (!cleanTicker) return;

    const settings = currentSettings();
    const params = new URLSearchParams({
      ticker: cleanTicker,
      lang: language,
      [SECTOR_WEIGHTS_QUERY_PARAM]: sectorWeightsSearchParam(settings.useSectorWeights),
    });

    setTicker(cleanTicker);
    setLastTicker(cleanTicker);
    window.dispatchEvent(
      new CustomEvent(APP_ANALYSIS_REQUEST_EVENT, {
        detail: {
          ticker: cleanTicker,
          language,
          settings,
        },
      }),
    );
    router.push(`/?${params.toString()}`);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;

    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;
    window.dispatchEvent(new CustomEvent(APP_LANGUAGE_CHANGE_EVENT, { detail: { language: nextLanguage } }));
  }

  function commitSettings(nextSettings: AnalysisSettings) {
    setUseSectorWeights(nextSettings.useSectorWeights);
    setSupplementalMetricSettings(nextSettings.supplementalMetrics);
    writeAnalysisSettings(APP_SETTINGS_STORAGE_KEY, nextSettings);
    window.dispatchEvent(new CustomEvent(APP_ANALYSIS_SETTINGS_CHANGE_EVENT, { detail: { settings: nextSettings } }));
  }

  function changeUseSectorWeights(nextUseSectorWeights: boolean) {
    if (nextUseSectorWeights === useSectorWeights) return;

    commitSettings({
      useSectorWeights: nextUseSectorWeights,
      supplementalMetrics: supplementalMetricSettings,
    });
  }

  function changeSupplementalMetric(metricId: SupplementalMetricId, enabled: boolean) {
    if (enabled === supplementalMetricSettings[metricId]) return;

    commitSettings({
      useSectorWeights,
      supplementalMetrics: {
        ...supplementalMetricSettings,
        [metricId]: enabled,
      },
    });
  }

  return (
    <div className="appShell globalHeaderShell">
      <header className="topBar appHeader globalHeader">
        <div className="headerBrandCluster">
          <Link className="brand" href="/">
            <Image alt="" src="/assets/logo.webp" width={64} height={64} priority />
            <div className="brandText">
              <h1>{t.brandTitle}</h1>
            </div>
          </Link>

          <HeaderNavLinks ariaLabel={header.menu} className="headerNav desktopHeaderNav" copy={header} />
        </div>

        <div className="headerTools">
          <form className="searchForm headerSearch" onSubmit={submitTicker}>
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
              onClick={() => requestAnalysis(lastTicker)}
            >
              <RefreshCw size={18} />
            </button>
          </form>

          <div className="desktopHeaderControls">
            <HeaderSettingsModule
              language={language}
              menuId="app-settings-menu"
              supplementalMetricSettings={supplementalMetricSettings}
              useSectorWeights={useSectorWeights}
              onSupplementalMetricChange={changeSupplementalMetric}
              onUseSectorWeightsChange={changeUseSectorWeights}
            />
            <LanguageToggle
              ariaLabel={t.aria.language}
              language={language}
              loading={loading}
              onLanguageChange={changeLanguage}
            />
          </div>
          <button
            className="iconButton secondaryButton mobileMenuButton"
            type="button"
            aria-controls={mobileMenuId}
            aria-expanded={mobileMenuOpen}
            aria-label={header.menu}
            title={header.menu}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <>
          <div className="mobileDrawerBackdrop" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobileDrawer" id={mobileMenuId} role="dialog" aria-modal="true" aria-label={header.menu}>
            <div className="mobileDrawerHeader">
              <strong>{header.menu}</strong>
              <button
                className="iconButton secondaryButton mobileDrawerClose"
                type="button"
                aria-label={header.menu}
                title={header.menu}
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <HeaderNavLinks
              ariaLabel={header.menu}
              className="mobileDrawerNav"
              copy={header}
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <div className="mobileDrawerControls">
              <section className="mobileDrawerSettings" aria-label={settingsPanelCopy[language].title}>
                <SettingsPanelContent
                  language={language}
                  supplementalMetricSettings={supplementalMetricSettings}
                  useSectorWeights={useSectorWeights}
                  onSupplementalMetricChange={changeSupplementalMetric}
                  onUseSectorWeightsChange={changeUseSectorWeights}
                />
              </section>
              <LanguageToggle
                ariaLabel={t.aria.language}
                className="mobileLanguageToggle"
                language={language}
                loading={loading}
                onLanguageChange={changeLanguage}
              />
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function HeaderNavLinks({
  ariaLabel,
  className,
  copy,
  onNavigate,
}: {
  ariaLabel: string;
  className: string;
  copy: HeaderCopy;
  onNavigate?: () => void;
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      <Link className="navLink" href="/sp500-top" onClick={onNavigate}>
        <BarChart3 size={16} />
        <span>{copy.sp500Top}</span>
      </Link>
      <a className="navLink" href={METHODOLOGY_SCORING_PROFILES_URL} target="_blank" rel="noreferrer" onClick={onNavigate}>
        <ExternalLink size={16} />
        <span>{copy.methodology}</span>
      </a>
      <a className="navLink" href="https://github.com/Wlad1slav/Q-GARP-Framework" target="_blank" rel="noreferrer" onClick={onNavigate}>
        <GitHubIcon size={16} />
        <span>{copy.github}</span>
      </a>
    </nav>
  );
}

function LanguageToggle({
  ariaLabel,
  className = "",
  language,
  loading,
  onLanguageChange,
}: {
  ariaLabel: string;
  className?: string;
  language: Language;
  loading: boolean;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <div className={`languageToggle ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {supportedLanguages.map((nextLanguage) => (
        <button
          aria-pressed={language === nextLanguage}
          className={`languageOption ${language === nextLanguage ? "active" : ""}`}
          disabled={loading && language !== nextLanguage}
          key={nextLanguage}
          type="button"
          onClick={() => onLanguageChange(nextLanguage)}
        >
          {languageLabels[nextLanguage]}
        </button>
      ))}
    </div>
  );
}

function readInitialHeaderLanguage(): Language {
  if (typeof window === "undefined") return defaultLanguage;

  const params = new URLSearchParams(window.location.search);
  return normalizeLanguage(params.get("lang") ?? window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function readInitialHeaderTicker() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return normalizeTicker(params.get("ticker") ?? "");
}

function HeaderSettingsModule({
  language,
  menuId,
  supplementalMetricSettings,
  useSectorWeights,
  onSupplementalMetricChange,
  onUseSectorWeightsChange,
}: {
  language: Language;
  menuId: string;
  supplementalMetricSettings: SupplementalMetricSettings;
  useSectorWeights: boolean;
  onSupplementalMetricChange: (metricId: SupplementalMetricId, enabled: boolean) => void;
  onUseSectorWeightsChange: (enabled: boolean) => void;
}) {
  const t = settingsPanelCopy[language];
  const [open, setOpen] = useState(false);

  return (
    <aside className="settingsModule settingsModuleInline" aria-label={t.title}>
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
        <SettingsPanelContent
          language={language}
          supplementalMetricSettings={supplementalMetricSettings}
          useSectorWeights={useSectorWeights}
          onSupplementalMetricChange={onSupplementalMetricChange}
          onUseSectorWeightsChange={onUseSectorWeightsChange}
        />
      </div>
    </aside>
  );
}

function SettingsPanelContent({
  language,
  supplementalMetricSettings,
  useSectorWeights,
  onSupplementalMetricChange,
  onUseSectorWeightsChange,
}: {
  language: Language;
  supplementalMetricSettings: SupplementalMetricSettings;
  useSectorWeights: boolean;
  onSupplementalMetricChange: (metricId: SupplementalMetricId, enabled: boolean) => void;
  onUseSectorWeightsChange: (enabled: boolean) => void;
}) {
  const t = settingsPanelCopy[language];
  const supplementalCopy = supplementalMetricsCopy[language];

  return (
    <>
      <div className="settingsModuleHeader">
        <Settings size={16} />
        <strong>{t.title}</strong>
      </div>
      <div className="settingsOption">
        <label className="settingsToggleLabel">
          <input
            checked={useSectorWeights}
            type="checkbox"
            onChange={(event) => onUseSectorWeightsChange(event.currentTarget.checked)}
          />
          <span className="settingsSwitch" aria-hidden="true" />
          <span>{t.sectorWeights}</span>
        </label>
        <div className="settingsSectionLabel">{t.supplementalMetricsTitle}</div>
        {supplementalMetricIds.map((metricId) => (
          <label className="settingsToggleLabel" key={metricId}>
            <input
              checked={supplementalMetricSettings[metricId]}
              type="checkbox"
              onChange={(event) => onSupplementalMetricChange(metricId, event.currentTarget.checked)}
            />
            <span className="settingsSwitch" aria-hidden="true" />
            <span>{supplementalCopy[metricId]}</span>
          </label>
        ))}
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
    </>
  );
}

function GitHubIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.66 7.66 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
