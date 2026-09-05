export const scoringCopy = {
  uk: {
    title: "Звідки береться оцінка",
    intro:
      "П’ять складових додають бали. Ризики та прогалини в даних зменшують результат.",
    raw: "Бал за показниками",
    penalty: "Ризики та дані",
    final: "Підсумкова оцінка",
    points: "б.",
    of: "із",
    weight: "Вага",
    score: "Оцінка",
    contribution: "Внесок у результат",
    earned: "Набрані бали",
    gap: "Не набрано до максимуму",
    gapHelp:
      "Довжина смуги показує вагу складової, заповнення — набрані бали. Світла частина — недобір до максимуму, який уже врахований в оцінці й окремо не віднімається.",
    openHint:
      "Натисніть на складову, щоб побачити показники, пороги та розрахунок.",
    support: "Найбільший внесок",
    drag: "Найбільший недобір",
    confidence: "Повнота даних",
    confidenceHelp:
      "Частка доступних даних з урахуванням їхніх ваг. Це не ймовірність зростання акції.",
    confidenceRule:
      "Штраф за дані: (85 − повнота у %) × 0,18, з округленням до цілого та мінімумом 0. Нижче 55% — ще 4 бали ризику. Для штрафу загальна повнота береться до округлення.",
    coverageWarning:
      "Неповні дані впливають на цей бал. Перевірте відсутні показники нижче.",
    allSignals: "Усі показники",
    weakSignals: "Слабкі та відсутні",
    noWeakSignals:
      "У цій складовій немає показників нижче 45 балів або відсутніх даних.",
    signal: "Показник і правило оцінювання",
    value: "Значення",
    signalWeight: "Вага у складовій",
    signalPoints: "Бали у складовій",
    missing: "Даних немає",
    missingCritical: "Критичний показник відсутній: модель підставляє 28/100.",
    missingRegular: "Показник відсутній: модель підставляє 42/100.",
    positive: "Підсилює",
    mixed: "Змішаний сигнал",
    negative: "Послаблює",
    calculation: "Як пораховано",
    calculationHelp:
      "Оцінка показника × його вага = бали у складовій. Сума округлюється до цілого; оцінка складової множиться на її вагу в загальному результаті.",
    rounding:
      "Внески показані до десятих. Модель округлює суму до цілого, тому сума видимих чисел може трохи відрізнятися.",
    riskTitle: "Що додатково знижує бал",
    riskHelp:
      "Ці штрафи віднімаються після оцінювання п’яти складових. Деякі ризики також впливають на окремі показники — так влаштована модель.",
    noRisks: "Додаткових штрафів за правилами моделі немає.",
    explicitRisks: "Штраф за ризики",
    confidencePenalty: "Штраф за неповні дані",
    totalPenalty: "Разом віднімається",
    caps: "Сума ризиків обмежена 26 балами. Разом зі штрафом за неповні дані — максимум 30 балів.",
    floor:
      "Підсумок обмежений діапазоном 0–100: від’ємний результат показується як 0.",
    methodology: "Як читати оцінку",
    methodologyIntro:
      "Q-GARP оцінює якість бізнесу, зростання та ціну акції за кількісними даними.",
    scaleBad: "0–44 · слабкий",
    scaleWatch: "45–69 · змішаний",
    scaleGood: "70–100 · сильний*",
    scaleHelp:
      "*Сильний профіль потребує повноти даних від 55%. За повноти до 15% статус — «Даних замало», незалежно від бала.",
    profiles:
      "Вага визначає, наскільки складова впливає на результат. Ваги всіх складових разом становлять 100%.",
    sectorOn: "Галузеві ваги увімкнено.",
    sectorOff:
      "Галузеві ваги вимкнено: застосовано базові ваги. Пороги показників залишаються галузевими.",
    supplemental:
      "Додаткові метрики нижче дають контекст і не входять до оцінки Q-GARP.",
    legacy:
      "Деталізація цього розрахунку недоступна. Оновіть аналіз, щоб отримати внесок кожного показника.",
    context: "Вихідні дані для порівняння",
  },
  en: {
    title: "Where the score comes from",
    intro:
      "Five components earn points. Risks and gaps in the data reduce the result.",
    raw: "Score from indicators",
    penalty: "Risks & data",
    final: "Final score",
    points: "pts",
    of: "of",
    weight: "Weight",
    score: "Score",
    contribution: "Contribution to the result",
    earned: "Points earned",
    gap: "Gap to maximum",
    gapHelp:
      "Bar length shows the component’s weight; the filled portion shows points earned. The pale portion is the gap to a perfect score, already reflected in the result and not deducted again.",
    openHint:
      "Select a component to see its inputs, thresholds, and calculation.",
    support: "Largest contribution",
    drag: "Largest scoring gap",
    confidence: "Data coverage",
    confidenceHelp:
      "The weighted share of available inputs. This is not the probability of the stock going up.",
    confidenceRule:
      "Data penalty: (85 − coverage in %) × 0.18, rounded to a whole number with a minimum of 0. Below 55%, another 4 risk points apply. Penalties use overall coverage before rounding.",
    coverageWarning:
      "Incomplete data affects this score. Review the missing inputs below.",
    allSignals: "All inputs",
    weakSignals: "Weak & missing",
    noWeakSignals:
      "This component has no inputs below 45 points or missing data.",
    signal: "Input and scoring rule",
    value: "Value",
    signalWeight: "Weight in component",
    signalPoints: "Component points",
    missing: "Missing data",
    missingCritical: "Critical input missing: the model substitutes 28/100.",
    missingRegular: "Input missing: the model substitutes 42/100.",
    positive: "Strengthens",
    mixed: "Mixed signal",
    negative: "Weakens",
    calculation: "How it is calculated",
    calculationHelp:
      "Input score × its weight = component points. The sum is rounded to a whole number; the component score is multiplied by its weight in the overall result.",
    rounding:
      "Contributions are displayed to one decimal. The model rounds the total to a whole number, so displayed values may not add up exactly.",
    riskTitle: "What else reduces the score",
    riskHelp:
      "These penalties are deducted after scoring the five components. Some risks also affect individual inputs, as designed by the model.",
    noRisks: "No additional penalties under the model’s rules.",
    explicitRisks: "Risk penalty",
    confidencePenalty: "Incomplete data penalty",
    totalPenalty: "Total deducted",
    caps: "Risk points are capped at 26. Including the data penalty, the maximum deduction is 30 points.",
    floor:
      "The final score is limited to 0–100: a negative result is shown as 0.",
    methodology: "How to read the score",
    methodologyIntro:
      "Q-GARP evaluates business quality, growth, and stock valuation using quantitative data.",
    scaleBad: "0–44 · weak",
    scaleWatch: "45–69 · mixed",
    scaleGood: "70–100 · strong*",
    scaleHelp:
      "*A strong profile requires at least 55% data coverage. At 15% or below, the status is “Not enough data” regardless of the score.",
    profiles:
      "A component’s weight determines its influence on the result. All component weights add up to 100%.",
    sectorOn: "Sector weights are enabled.",
    sectorOff:
      "Sector weights are disabled: baseline weights apply. Input thresholds remain sector-specific.",
    supplemental:
      "The supplemental metrics below provide context and are not included in the Q-GARP score.",
    legacy:
      "Details are unavailable for this calculation. Refresh the analysis to see each input’s contribution.",
    context: "Comparison data",
  },
} as const;

export const indicatorExplanations = {
  uk: {
    double:
      "Чи достатньо швидко зростають виручка, прибуток і вільний грошовий потік? Орієнтир — близько 14,9% на рік для подвоєння за 5 років. Це оцінка темпів бізнесу, а не прогноз подвоєння ціни акції.",
    valuation:
      "Скільки коштує бізнес відносно прибутку, виручки та грошового потоку? Нижчі додатні мультиплікатори порівняно з ринком, конкурентами й власною історією підвищують бал. Збитки та від’ємний FCF погіршують результат.",
    growth:
      "Чи зростає компанія швидше за конкурентів і чи відповідає галузевим орієнтирам? Модель поєднує річні зміни, середні темпи за 3 роки та прогнози. Вибір конкурентів впливає на порівняння.",
    margins:
      "Чи перетворюється виручка на прибуток і вільні гроші? Вищі та стійкіші маржі, ефективність капіталу й помірний борг підвищують бал. Пороги залежать від сектору.",
    peg: "Чи виправдовує зростання поточну ціну з урахуванням винагороди акціями (SBC)? Нижчий додатний PEG і менша частка SBC підвищують бал. Модель також перевіряє, чи залишається додатним FCF після SBC.",
  },
  en: {
    double:
      "Are revenue, profit, and free cash flow growing fast enough? The benchmark is about 14.9% a year to double in 5 years. This evaluates business growth, not whether the share price will double.",
    valuation:
      "How expensive is the business relative to its profit, revenue, and cash flow? Lower positive multiples versus the market, peers, and its own history improve the score. Losses and negative FCF weaken it.",
    growth:
      "Is the company growing faster than peers and meeting sector benchmarks? The model combines annual changes, 3-year growth rates, and forecasts. The selected peers affect the comparison.",
    margins:
      "Does revenue translate into profit and free cash flow? Higher, resilient margins, efficient use of capital, and moderate debt improve the score. Thresholds depend on the sector.",
    peg: "Does growth justify the valuation after stock-based compensation (SBC)? A lower positive PEG and less SBC improve the score. The model also checks whether FCF remains positive after SBC.",
  },
} as const;

export const signalLabels = {
  uk: {
    revenueCagr: "Виручка · CAGR за 3 роки",
    incomeCagr: "Прибуток · CAGR за 3 роки",
    fcfCagr: "FCF · CAGR за 3 роки",
    forwardRevenue: "Прогноз зростання виручки",
    forwardEarnings: "Прогноз зростання прибутку",
    peMarket: "P/E проти ринку (SPY)",
    pePeers: "P/E проти конкурентів",
    forwardPe: "Прогнозний P/E проти конкурентів",
    peHistory: "P/E проти власної історії",
    psHistory: "P/S проти власної історії",
    psPeers: "P/S проти конкурентів",
    pfcfHistory: "P/FCF проти власної історії",
    evPeers: "EV/EBITDA проти конкурентів",
    pbPeers: "P/B проти конкурентів",
    pb: "P/B · абсолютний рівень",
    income: "Чистий прибуток",
    fcf: "Вільний грошовий потік (FCF)",
    revenuePeers: "Зростання виручки проти конкурентів",
    earningsPeers: "Зростання прибутку проти конкурентів",
    forwardPeers: "Прогноз виручки проти зростання конкурентів",
    grossDelta: "Зміна валової маржі за 3 роки",
    operatingDelta: "Зміна операційної маржі за 3 роки",
    netDelta: "Зміна чистої маржі за 3 роки",
    grossMargin: "Валова маржа",
    operatingMargin: "Операційна маржа",
    profitMargin: "Чиста маржа",
    fcfMargin: "Маржа FCF",
    marginPeers: "Чиста маржа проти конкурентів",
    roePeers: "ROE проти конкурентів",
    roe: "Рентабельність власного капіталу (ROE)",
    roic: "Рентабельність інвестованого капіталу (ROIC proxy)",
    debt: "Борг / власний капітал",
    netDebt: "Чистий борг / FCF",
    revenueFloor: "Мінімальний темп зростання виручки",
    peg: "PEG з урахуванням SBC",
    pegGrowth: "Зростання прибутку для PEG",
    sbcRevenue: "SBC / виручка",
    sbcFcf: "SBC / FCF",
    adjustedFcf: "FCF після винагороди акціями",
  },
  en: {
    revenueCagr: "Revenue · 3-year CAGR",
    incomeCagr: "Net income · 3-year CAGR",
    fcfCagr: "FCF · 3-year CAGR",
    forwardRevenue: "Forward revenue growth",
    forwardEarnings: "Forward earnings growth",
    peMarket: "P/E vs market (SPY)",
    pePeers: "P/E vs peers",
    forwardPe: "Forward P/E vs peers",
    peHistory: "P/E vs own history",
    psHistory: "P/S vs own history",
    psPeers: "P/S vs peers",
    pfcfHistory: "P/FCF vs own history",
    evPeers: "EV/EBITDA vs peers",
    pbPeers: "P/B vs peers",
    pb: "Absolute P/B",
    income: "Net income",
    fcf: "Free cash flow (FCF)",
    revenuePeers: "Revenue growth vs peers",
    earningsPeers: "Earnings growth vs peers",
    forwardPeers: "Forward revenue vs peer growth",
    grossDelta: "3-year gross margin change",
    operatingDelta: "3-year operating margin change",
    netDelta: "3-year net margin change",
    grossMargin: "Gross margin",
    operatingMargin: "Operating margin",
    profitMargin: "Net margin",
    fcfMargin: "FCF margin",
    marginPeers: "Net margin vs peers",
    roePeers: "ROE vs peers",
    roe: "Return on equity (ROE)",
    roic: "Return on invested capital (ROIC proxy)",
    debt: "Debt / equity",
    netDebt: "Net debt / FCF",
    revenueFloor: "Revenue growth floor",
    peg: "PEG including SBC",
    pegGrowth: "Earnings growth used for PEG",
    sbcRevenue: "SBC / revenue",
    sbcFcf: "SBC / FCF",
    adjustedFcf: "FCF after stock-based compensation",
  },
} as const;
