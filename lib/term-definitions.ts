export const termDefinitions = {
  cagr: "CAGR - середньорічний темп зростання. Показує, яким рівним темпом метрика росла б щороку за період.",
  fcf: "FCF - free cash flow, вільний грошовий потік після операційних витрат і капітальних інвестицій.",
  sbc: "SBC - stock-based compensation, компенсація працівникам акціями або опціонами. Може розмивати частку акціонерів.",
  peg: "PEG - співвідношення P/E до очікуваного росту прибутку. Нижче 1 часто вважається дешевшим ростом, але залежить від якості прогнозів.",
  pe: "P/E - ціна компанії відносно її прибутку. Нижче значення може означати дешевшу оцінку, але не завжди кращий бізнес.",
  ps: "P/S - ціна компанії відносно виручки. Корисно для компаній, де прибуток ще нестабільний.",
  pfcf: "P/FCF - ціна компанії відносно вільного грошового потоку. Показує, скільки інвестори платять за cash flow.",
  eps: "EPS - earnings per share, прибуток на одну акцію. Зростання EPS часто важливіше за сам ріст виручки.",
  yoy: "YoY - year over year, зміна показника проти такого самого періоду минулого року.",
  peers: "Peers - схожі компанії для порівняння. Найкраще обирати прямих конкурентів вручну; Yahoo-рекомендації тут лише стартова група.",
  grossMargin: "Gross margin - валова маржа: частка виручки після собівартості продукту або послуги.",
  operatingMargin: "Operating margin - операційна маржа: частка виручки після операційних витрат, але до податків і частини фінансових статей.",
  netMargin: "Net margin - чиста маржа: частка виручки, яка залишається як чистий прибуток.",
  roe: "ROE - return on equity, прибутковість власного капіталу. Показує, наскільки ефективно компанія заробляє на капіталі акціонерів.",
  marketCap: "Капіталізація - ринкова вартість компанії: ціна акції, помножена на кількість акцій.",
  spy: "SPY - ETF на S&P 500. Використовується як грубий бенчмарк ринку США.",
} as const;

export type TermKey = keyof typeof termDefinitions;

const labelMatchers: Array<[RegExp, TermKey]> = [
  [/P\/FCF/i, "pfcf"],
  [/P\/S/i, "ps"],
  [/P\/E/i, "pe"],
  [/CAGR/i, "cagr"],
  [/FCF/i, "fcf"],
  [/SBC/i, "sbc"],
  [/PEG/i, "peg"],
  [/EPS/i, "eps"],
  [/YoY/i, "yoy"],
  [/peers?/i, "peers"],
  [/SPY/i, "spy"],
  [/Gross margin/i, "grossMargin"],
  [/Operating margin/i, "operatingMargin"],
  [/Net margin/i, "netMargin"],
  [/ROE/i, "roe"],
];

export function termForLabel(label: string): TermKey | undefined {
  return labelMatchers.find(([matcher]) => matcher.test(label))?.[1];
}
