import type { MetricTone } from "./analysis-types";

export const supportedLanguages = ["uk", "en"] as const;
export type Language = (typeof supportedLanguages)[number];

export const defaultLanguage: Language = "uk";

export function normalizeLanguage(value: string | null | undefined): Language {
  return value === "en" ? "en" : defaultLanguage;
}

export function localeForLanguage(language: Language) {
  return language === "en" ? "en-US" : "uk-UA";
}

export const languageLabels: Record<Language, string> = {
  uk: "UA",
  en: "EN",
};

export const uiCopy = {
  uk: {
    brandTitle: "Q-GARP Framework - чеклист Тараса Гука",
    brandSubtitle: "Чеклист якісного зростання за розумною ціною",
    notAvailable: "н/д",
    currencyUnavailable: "валюта н/д",
    copied: "Скопійовано",
    prompt: "Prompt",
    actions: {
      analyze: "Оцінити",
      refresh: "Оновити",
      apply: "Застосувати",
      reset: "Скинути",
    },
    aria: {
      ticker: "Тікер",
      language: "Мова",
      summary: "Підсумок",
      metrics: "Показники",
      competitors: "Конкуренти",
      score: (score: number) => `Оцінка ${score} зі 100`,
    },
    errors: {
      loadData: "Не вдалося отримати дані.",
    },
    facts: {
      price: "Ціна",
      marketCap: "Капіталізація",
      sector: "Сектор",
      updated: "Оновлено",
    },
    peers: {
      label: "Peers",
      manualBadge: "Peer-група",
      actualBadge: "Рекомендована Peer-група",
      recommendedBadge: "Yahoo peer-група",
      manualText: "Порівняння росту рахується по медіані вибраних конкурентів і збережене локально для цього тікера.",
      actualText:
        "Рекомендована peer-група. Її можна замінити вручну для точнішого порівняння.",
      recommendedText:
        "Ми не маємо рекомендованої peer-групи для цього тікера, тому використано fallback з Yahoo. Для якіснішої оцінки краще вибрати конкурентів вручну.",
      recommended: "Базова група",
      applyTitle: "Застосувати peer-групу",
      promptTitle: "Скопіювати prompt для підбору конкурентів",
      resetTitle: "Скинути на базову групу",
    },
    scoreMeta: {
      confidence: "Довіра",
      rawScore: "Raw score",
      riskPenalty: "Штраф",
      profile: "Профіль",
    },
    states: {
      loadingTitle: "Рахую показники",
      loadingText: "Фінзвітність, мультиплікатори, peer-група, SBC.",
      errorTitle: "Тікер не оброблено",
      emptyTitle: "Тікер",
      emptyText: "Наприклад: AAPL, MSFT, NVDA, TSLA.",
    },
    toneLabels: {
      good: "Так",
      watch: "Під питанням",
      bad: "Ні",
      unknown: "Даних замало",
    } satisfies Record<MetricTone, string>,
  },
  en: {
    brandTitle: "Q-GARP Framework - Taras Guk checklist",
    brandSubtitle: "Quality growth at a reasonable price checklist",
    notAvailable: "n/a",
    currencyUnavailable: "currency n/a",
    copied: "Copied",
    prompt: "Prompt",
    actions: {
      analyze: "Analyze",
      refresh: "Refresh",
      apply: "Apply",
      reset: "Reset",
    },
    aria: {
      ticker: "Ticker",
      language: "Language",
      summary: "Summary",
      metrics: "Metrics",
      competitors: "Competitors",
      score: (score: number) => `Score ${score} out of 100`,
    },
    errors: {
      loadData: "Could not load data.",
    },
    facts: {
      price: "Price",
      marketCap: "Market cap",
      sector: "Sector",
      updated: "Updated",
    },
    peers: {
      label: "Peers",
      manualBadge: "Peer group",
      actualBadge: "Recommended peer group",
      recommendedBadge: "Yahoo peer group",
      manualText: "Growth comparison uses the median of your selected competitors and is saved locally for this ticker.",
      actualText:
        "Recommended peer group. You can still replace it manually for a sharper comparison.",
      recommendedText:
        "We do not have a recommended peer for this ticker, so Yahoo fallback peers are used. For a sharper read, choose competitors manually.",
      recommended: "Baseline",
      applyTitle: "Apply peer group",
      promptTitle: "Copy prompt for competitor selection",
      resetTitle: "Reset to baseline",
    },
    scoreMeta: {
      confidence: "Confidence",
      rawScore: "Raw score",
      riskPenalty: "Penalty",
      profile: "Profile",
    },
    states: {
      loadingTitle: "Calculating metrics",
      loadingText: "Financials, multiples, peer group, SBC.",
      errorTitle: "Ticker was not processed",
      emptyTitle: "Ticker",
      emptyText: "For example: AAPL, MSFT, NVDA, TSLA.",
    },
    toneLabels: {
      good: "Yes",
      watch: "Watch",
      bad: "No",
      unknown: "Not enough data",
    } satisfies Record<MetricTone, string>,
  },
} as const;

export const analysisCopy = {
  uk: {
    notAvailable: "н/д",
    pointSuffix: "п.п.",
    errors: {
      invalidTicker: "Введіть коректний тікер.",
      fetchTicker: "Не вдалося отримати дані по тікеру.",
    },
    scoreLabels: {
      good: "Сильний профіль",
      watch: "Змішаний профіль",
      bad: "Слабкий профіль",
      unknown: "Даних замало",
    } satisfies Record<MetricTone, string>,
    dataNotes: {
      manualPeers: "Дані: Yahoo Finance; peer-група: вручну обрані конкуренти, медіана по доступних показниках.",
      actualPeers:
        "Дані: Yahoo Finance; peer-група: ACTUAL_PEERS CSV, медіана по доступних показниках.",
      recommendedPeers:
        "Дані: Yahoo Finance; в ACTUAL_PEERS немає peer-групи для цього тікера, тому використано Yahoo fallback. Для якісного порівняння краще обрати конкурентів вручну.",
      shortHistory: "Історія фінзвітності коротка, CAGR може бути нестабільним.",
      missingCashFlow: "Cash flow або SBC доступні не для всіх емітентів.",
      missingBalanceSheet: "Balance sheet доступний не повністю, боргові метрики можуть бути неповними.",
      missingTtm: "TTM-фінанси відсутні, частина метрик взята з останнього річного звіту.",
      noPeers: "Peer-порівняння недоступне для цього тікера.",
      noHistory: "Історичні valuation-мультиплікатори не вдалося побудувати.",
      disclaimer: "Не є інвестиційною рекомендацією.",
    },
    indicators: {
      double: {
        title: "Подвоєння за 5 років",
        subtitle: "Виручка, прибуток, FCF",
        verdict: {
          good: "Темпи вже близькі або вищі за рівень, потрібний для подвоєння.",
          watch: "Є окремі сильні темпи, але повної впевненості для подвоєння поки немає.",
          bad: "Поточні темпи нижчі за потрібні для подвоєння за 5 років.",
          unknown: "Недостатньо історії для оцінки подвоєння.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          requiredCagr: "Потрібний CAGR",
          revenueCagr3y: "Виручка CAGR 3р",
          netIncomeCagr3y: "Прибуток CAGR 3р",
          fcfCagr3y: "FCF CAGR 3р",
          epsForecast: "Прогноз EPS",
          doubleSignals: "Сигналів подвоєння",
        },
      },
      valuation: {
        title: "Ціна проти ринку",
        subtitle: "Ринок, peers, історія",
        verdict: {
          good: "Оцінка виглядає дешевшою за кількома доступними мультиплікаторами.",
          watch: "Мультиплікатори неоднорідні: частина дешевша, частина вже з премією.",
          bad: "Папір торгується з премією до доступних бенчмарків.",
          unknown: "Немає достатніх мультиплікаторів для порівняння ціни.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          peHistory: "P/E істор.",
          psHistory: "P/S істор.",
          pfcfHistory: "P/FCF істор.",
        },
      },
      growth: {
        title: "Ріст проти конкурентів",
        subtitle: "Виручка, прибуток, FCF",
        verdict: {
          good: "Компанія росте швидше за peer-групу або має сильний власний тренд.",
          watch: "Ріст конкурентний, але не всюди кращий за групу порівняння.",
          bad: "Темпи росту слабші за доступну peer-групу.",
          unknown: "Немає достатніх даних для порівняння росту.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          revenueYoy: "Виручка YoY",
          revenuePeers: "Виручка peers",
          epsYoy: "EPS YoY",
          epsPeers: "EPS peers",
          revenueCagr: "Виручка CAGR",
          netIncomeCagr: "Прибуток CAGR",
          fcfCagr: "FCF CAGR",
          forwardRevenue: "Прогноз виручки",
        },
      },
      margins: {
        title: "Маржа й перевага",
        subtitle: "Якість росту",
        verdict: {
          good: "Ріст підтримується маржами та якісною прибутковістю.",
          watch: "Маржі здебільшого тримаються, але перевага не бездоганна.",
          bad: "Маржі або прибутковість слабшають на фоні росту.",
          unknown: "Недостатньо даних для оцінки маржинальності.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          grossMargin: "Gross margin",
          grossChange3y: "Gross зміна 3р",
          operatingMargin: "Operating margin",
          operatingChange: "Operating зміна",
          netMargin: "Net margin",
          fcfMargin: "FCF margin",
          roe: "ROE",
          roic: "ROIC proxy",
          debtToEquity: "Debt/equity",
        },
      },
      peg: {
        title: "PEG з SBC",
        subtitle: "PEG < 1 після компенсацій",
        verdict: {
          good: "SBC не ламає картину: скоригований PEG нижче або близько 1.",
          watch: "PEG або SBC потребують уваги, але сигнал не критичний.",
          bad: "PEG з урахуванням SBC виглядає дорогим.",
          unknown: "Немає даних для PEG або SBC-корекції.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          pegYahoo: "PEG Yahoo",
          pegWithSbc: "PEG з SBC",
          sbcRevenue: "SBC / виручка",
          sbcFcf: "SBC / FCF",
          adjustedFcf: "FCF після SBC",
          epsGrowth: "EPS growth",
        },
      },
    },
  },
  en: {
    notAvailable: "n/a",
    pointSuffix: "pp",
    errors: {
      invalidTicker: "Enter a valid ticker.",
      fetchTicker: "Could not load ticker data.",
    },
    scoreLabels: {
      good: "Strong profile",
      watch: "Mixed profile",
      bad: "Weak profile",
      unknown: "Not enough data",
    } satisfies Record<MetricTone, string>,
    dataNotes: {
      manualPeers: "Data: Yahoo Finance; peer group: manually selected competitors, median of available metrics.",
      actualPeers: "Data: Yahoo Finance; peer group: ACTUAL_PEERS CSV, median of available metrics.",
      recommendedPeers:
        "Data: Yahoo Finance; ACTUAL_PEERS has no peer group for this ticker, so Yahoo fallback peers are used. For a higher-quality comparison, choose competitors manually.",
      shortHistory: "Financial statement history is short, so CAGR may be unstable.",
      missingCashFlow: "Cash flow or SBC is not available for all issuers.",
      missingBalanceSheet: "Balance sheet data is incomplete, so leverage metrics may be partial.",
      missingTtm: "TTM financials are missing, so some metrics use the latest annual report.",
      noPeers: "Peer comparison is unavailable for this ticker.",
      noHistory: "Historical valuation multiples could not be built.",
      disclaimer: "Not investment advice.",
    },
    indicators: {
      double: {
        title: "Doubles in 5 years",
        subtitle: "Revenue, earnings, FCF",
        verdict: {
          good: "Growth is already near or above the pace needed to double.",
          watch: "Some growth signals are strong, but the case for doubling is not yet complete.",
          bad: "Current growth is below the pace needed to double in 5 years.",
          unknown: "Not enough history to judge the doubling case.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          requiredCagr: "Required CAGR",
          revenueCagr3y: "Revenue CAGR 3y",
          netIncomeCagr3y: "Net income CAGR 3y",
          fcfCagr3y: "FCF CAGR 3y",
          epsForecast: "EPS forecast",
          doubleSignals: "Doubling signals",
        },
      },
      valuation: {
        title: "Price vs market",
        subtitle: "Market, peers, history",
        verdict: {
          good: "Valuation looks cheaper across several available multiples.",
          watch: "Multiples are mixed: some cheaper, some already at a premium.",
          bad: "The stock trades at a premium to available benchmarks.",
          unknown: "Not enough valuation multiples for comparison.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          peHistory: "P/E history",
          psHistory: "P/S history",
          pfcfHistory: "P/FCF history",
        },
      },
      growth: {
        title: "Growth vs peers",
        subtitle: "Revenue, earnings, FCF",
        verdict: {
          good: "The company is growing faster than the peer group or has a strong internal trend.",
          watch: "Growth is competitive, but not consistently better than the comparison group.",
          bad: "Growth is weaker than the available peer group.",
          unknown: "Not enough data to compare growth.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          revenueYoy: "Revenue YoY",
          revenuePeers: "Revenue peers",
          epsYoy: "EPS YoY",
          epsPeers: "EPS peers",
          revenueCagr: "Revenue CAGR",
          netIncomeCagr: "Net income CAGR",
          fcfCagr: "FCF CAGR",
          forwardRevenue: "Revenue forecast",
        },
      },
      margins: {
        title: "Margins and advantage",
        subtitle: "Growth quality",
        verdict: {
          good: "Growth is supported by margins and high-quality profitability.",
          watch: "Margins mostly hold up, but the advantage is not flawless.",
          bad: "Margins or profitability are weakening against growth.",
          unknown: "Not enough data to assess margin quality.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          grossMargin: "Gross margin",
          grossChange3y: "Gross change 3y",
          operatingMargin: "Operating margin",
          operatingChange: "Operating change",
          netMargin: "Net margin",
          fcfMargin: "FCF margin",
          roe: "ROE",
          roic: "ROIC proxy",
          debtToEquity: "Debt/equity",
        },
      },
      peg: {
        title: "PEG with SBC",
        subtitle: "PEG < 1 after compensation",
        verdict: {
          good: "SBC does not break the picture: adjusted PEG is below or near 1.",
          watch: "PEG or SBC needs attention, but the signal is not critical.",
          bad: "PEG adjusted for SBC looks expensive.",
          unknown: "No data for PEG or the SBC adjustment.",
        } satisfies Record<MetricTone, string>,
        evidence: {
          pegYahoo: "PEG Yahoo",
          pegWithSbc: "PEG with SBC",
          sbcRevenue: "SBC / revenue",
          sbcFcf: "SBC / FCF",
          adjustedFcf: "FCF after SBC",
          epsGrowth: "EPS growth",
        },
      },
    },
  },
} as const;
