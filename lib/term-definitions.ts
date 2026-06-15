import type { Language } from "./i18n";

export const termDefinitions = {
  uk: {
    cagr: "CAGR - середньорічний темп зростання. Показує, яким рівним темпом метрика росла б щороку за період.",
    fcf: "FCF - free cash flow, вільний грошовий потік після операційних витрат і капітальних інвестицій.",
    sbc: "SBC - stock-based compensation, компенсація працівникам акціями або опціонами. Може розмивати частку акціонерів.",
    peg: "PEG - співвідношення P/E до очікуваного росту прибутку. Нижче 1 часто вважається дешевшим ростом, але залежить від якості прогнозів.",
    pe: "P/E - ціна компанії відносно її прибутку. Нижче значення може означати дешевшу оцінку, але не завжди кращий бізнес.",
    ps: "P/S - ціна компанії відносно виручки. Корисно для компаній, де прибуток ще нестабільний.",
    pfcf: "P/FCF - ціна компанії відносно вільного грошового потоку. Показує, скільки інвестори платять за cash flow.",
    eps: "EPS - earnings per share, прибуток на одну акцію. Зростання EPS часто важливіше за сам ріст виручки.",
    yoy: "YoY - year over year, зміна показника проти такого самого періоду минулого року.",
    peers:
      "Peers - схожі компанії для порівняння. Дефолтне джерело - ACTUAL_PEERS; якщо групи там немає, Yahoo fallback є лише стартовим наближенням.",
    grossMargin: "Gross margin - валова маржа: частка виручки після собівартості продукту або послуги.",
    operatingMargin:
      "Operating margin - операційна маржа: частка виручки після операційних витрат, але до податків і частини фінансових статей.",
    netMargin: "Net margin - чиста маржа: частка виручки, яка залишається як чистий прибуток.",
    roe: "ROE - return on equity, прибутковість власного капіталу. Показує, наскільки ефективно компанія заробляє на капіталі акціонерів.",
    marketCap: "Капіталізація - ринкова вартість компанії: ціна акції, помножена на кількість акцій.",
    spy: "SPY - ETF на S&P 500. Використовується як грубий бенчмарк ринку США.",
    totalShareholderYield:
      "Total Shareholder Yield - дохідність повернення капіталу акціонерам: дивідендна дохідність плюс buyback yield.",
    fcfYield: "FCF yield - вільний грошовий потік відносно ринкової капіталізації.",
    impliedUpside: "Implied upside - потенціал до медіанного target price аналітиків відносно поточної ціни.",
    fiftyTwoWeekRangePosition:
      "Позиція в 52-тижневому діапазоні - де поточна ціна між річним мінімумом і максимумом.",
    momentum: "Momentum - тренд ціни відносно її нещодавнього середнього значення.",
  },
  en: {
    cagr: "CAGR - compound annual growth rate. Shows the steady annual pace a metric would need to grow over a period.",
    fcf: "FCF - free cash flow after operating expenses and capital investments.",
    sbc: "SBC - stock-based compensation paid to employees in shares or options. It can dilute existing shareholders.",
    peg: "PEG - the P/E ratio divided by expected earnings growth. Below 1 often signals cheaper growth, but forecast quality matters.",
    pe: "P/E - company price relative to earnings. A lower value can mean a cheaper valuation, but not always a better business.",
    ps: "P/S - company price relative to revenue. Useful when earnings are still unstable.",
    pfcf: "P/FCF - company price relative to free cash flow. Shows how much investors pay for cash flow.",
    eps: "EPS - earnings per share. EPS growth is often more important than revenue growth alone.",
    yoy: "YoY - year over year, a metric's change versus the same period in the prior year.",
    peers:
      "Peers - comparable companies used for benchmarking. The default source is ACTUAL_PEERS; if no group exists there, Yahoo fallback is only a starting group.",
    grossMargin: "Gross margin - the share of revenue left after the cost of goods or services.",
    operatingMargin: "Operating margin - the share of revenue left after operating expenses, before taxes and some financing items.",
    netMargin: "Net margin - the share of revenue that remains as net income.",
    roe: "ROE - return on equity. Shows how efficiently a company earns on shareholder capital.",
    marketCap: "Market cap - the company's market value: share price multiplied by shares outstanding.",
    spy: "SPY - an ETF tracking the S&P 500. Used here as a rough benchmark for the US market.",
    totalShareholderYield:
      "Total Shareholder Yield - capital returned to shareholders: dividend yield plus buyback yield.",
    fcfYield: "FCF yield - free cash flow relative to market capitalization.",
    impliedUpside: "Implied upside - analyst median target price potential relative to the current price.",
    fiftyTwoWeekRangePosition: "52-week range position - where the current price sits between the yearly low and high.",
    momentum: "Momentum - price trend versus its recent moving average.",
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TermKey = keyof (typeof termDefinitions)["uk"];

const labelMatchers: Array<[RegExp, TermKey]> = [
  [/P\/FCF/i, "pfcf"],
  [/FCF yield/i, "fcfYield"],
  [/Total Shareholder Yield/i, "totalShareholderYield"],
  [/Implied upside/i, "impliedUpside"],
  [/52-тижнев|52-week/i, "fiftyTwoWeekRangePosition"],
  [/P\/S/i, "ps"],
  [/Momentum/i, "momentum"],
  [/P\/E/i, "pe"],
  [/CAGR/i, "cagr"],
  [/FCF/i, "fcf"],
  [/SBC/i, "sbc"],
  [/PEG/i, "peg"],
  [/EPS/i, "eps"],
  [/YoY/i, "yoy"],
  [/peers?|конкурент|peer-груп/i, "peers"],
  [/SPY/i, "spy"],
  [/Gross margin|Валова маржа/i, "grossMargin"],
  [/Operating margin|Операційна маржа/i, "operatingMargin"],
  [/Net margin|Чиста маржа/i, "netMargin"],
  [/ROE/i, "roe"],
  [/Market cap|Капіталізація/i, "marketCap"],
];

export function termForLabel(label: string): TermKey | undefined {
  return labelMatchers.find(([matcher]) => matcher.test(label))?.[1];
}
