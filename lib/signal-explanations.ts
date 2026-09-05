import type { Language } from "./i18n";
import { signalLabels } from "./scoring-copy";

type SignalKey = keyof typeof signalLabels.uk;
export type SignalExplanation = { meaning: string; importance: string };

const uk = {
  pe: {
    meaning: "P/E (price-to-earnings) — ціна акції, поділена на річний прибуток на акцію. Наприклад, 20× означає, що інвестори платять 20 одиниць ціни за одиницю річного прибутку.",
    importance: "Допомагає зіставити ціну з прибутковістю бізнесу. Нижчий P/E може означати дешевшу оцінку, але також слабші очікування зростання або більші ризики.",
  },
  ps: {
    meaning: "P/S (price-to-sales) — ринкова капіталізація, поділена на річну виручку. Показує, скільки інвестори платять за одиницю продажів.",
    importance: "Допомагає порівнювати оцінку, коли прибуток нестабільний. Водночас виручка не враховує витрат: компанії з різними маржами не варто порівнювати лише за P/S.",
  },
  pb: {
    meaning: "P/B (price-to-book) — ринкова капіталізація, поділена на балансовий власний капітал: активи мінус зобов’язання.",
    importance: "Дає орієнтир ціни відносно чистих активів, особливо для фінансових компаній. Для бізнесу з великою часткою нематеріальних активів цей показник менш показовий.",
  },
  fcf: {
    meaning: "FCF (free cash flow) — вільний грошовий потік: грошовий потік від операційної діяльності мінус капітальні інвестиції в основні активи.",
    importance: "Це кошти, доступні для погашення боргу, виплат акціонерам та інших цілей. На відміну від бухгалтерського прибутку, FCF показує фактичне генерування грошей; окремий рік може залежати від великих інвестицій.",
  },
  gross: {
    meaning: "Валова маржа — валовий прибуток, поділений на виручку. Показує частку продажів, що залишається після собівартості товарів або послуг.",
    importance: "Допомагає оцінити цінову силу продукту та виробничу ефективність. Вищий рівень залишає більше коштів на розвиток і решту витрат; порівнювати варто схожі бізнеси.",
  },
  operating: {
    meaning: "Операційна маржа — операційний прибуток, поділений на виручку. Враховує собівартість та операційні витрати, але не відсотки за боргом і податок на прибуток.",
    importance: "Показує прибутковість основного бізнесу та контроль витрат. Зростання виручки разом зі стійкою операційною маржею краще пояснює якість зростання, ніж самі продажі.",
  },
  net: {
    meaning: "Чиста маржа — чистий прибуток, поділений на виручку: частка продажів, що залишається після всіх витрат, відсотків і податків.",
    importance: "Показує, скільки прибутку компанія утримує з кожної одиниці виручки. Разові доходи, витрати або податкові ефекти можуть тимчасово змінювати цю частку.",
  },
  roe: {
    meaning: "ROE (return on equity) — рентабельність власного капіталу: чистий прибуток відносно капіталу акціонерів.",
    importance: "Допомагає оцінити ефективність використання коштів акціонерів. Високий ROE може бути наслідком як сильного бізнесу, так і великого боргу чи малого власного капіталу.",
  },
};

const en = {
  pe: {
    meaning: "P/E (price-to-earnings) is the share price divided by annual earnings per share. For example, 20× means investors pay 20 units of price for one unit of annual earnings.",
    importance: "Relates valuation to profitability. A lower P/E can mean a cheaper valuation, but it can also reflect weaker growth expectations or greater risk.",
  },
  ps: {
    meaning: "P/S (price-to-sales) is market capitalization divided by annual revenue. It shows how much investors pay for one unit of sales.",
    importance: "Helps compare valuations when earnings are unstable. Revenue excludes costs, so companies with different margins should not be compared on P/S alone.",
  },
  pb: {
    meaning: "P/B (price-to-book) is market capitalization divided by book equity: assets minus liabilities.",
    importance: "Relates price to net assets, particularly for financial companies. It is less informative for businesses whose value depends heavily on intangible assets.",
  },
  fcf: {
    meaning: "FCF (free cash flow) is cash flow from operating activities minus capital expenditure on fixed assets.",
    importance: "This cash is available for debt repayment, shareholder distributions, and other uses. Unlike accounting profit, FCF measures cash generation; a single year can be affected by major investments.",
  },
  gross: {
    meaning: "Gross margin is gross profit divided by revenue: the share of sales left after the cost of goods or services.",
    importance: "Helps assess pricing power and production efficiency. A higher margin leaves more money for growth and other costs; comparisons work best between similar businesses.",
  },
  operating: {
    meaning: "Operating margin is operating profit divided by revenue. It includes the cost of sales and operating expenses, before debt interest and income tax.",
    importance: "Measures core business profitability and cost control. Growing sales with resilient operating margins tells more about growth quality than sales alone.",
  },
  net: {
    meaning: "Net margin is net income divided by revenue: the share of sales left after all expenses, interest, and taxes.",
    importance: "Shows the profit retained from each unit of revenue. One-off gains, costs, or tax effects can temporarily change this ratio.",
  },
  roe: {
    meaning: "ROE (return on equity) measures net income relative to shareholders’ equity.",
    importance: "Helps assess how efficiently shareholder capital is used. High ROE can reflect a strong business, but also high debt or a small equity base.",
  },
};

const signalExplanations = {
  uk: {
    revenueCagr: {
      meaning: "Виручка — дохід від продажів до вирахування витрат. CAGR (compound annual growth rate) — середньорічний складений темп зростання. За 3 роки він дорівнює (кінцева виручка / початкова виручка)^(1/3) − 1.",
      importance: "Показує довгостроковий темп розширення бізнесу. Наприклад, 10% CAGR означає зростання приблизно зі 100 до 133 за 3 роки, але не обов’язково рівно на 10% щороку.",
    },
    incomeCagr: {
      meaning: "Чистий прибуток — те, що залишається після всіх витрат і податків. CAGR — середньорічний складений темп його зростання за 3 роки, розрахований за початковим і кінцевим значеннями.",
      importance: "Допомагає зрозуміти, чи перетворюється зростання продажів на прибуток. Разові ефекти та низька початкова база можуть завищувати темп; перехід від збитків до прибутку не описується звичайним CAGR.",
    },
    fcfCagr: {
      meaning: "FCF (free cash flow) — вільний грошовий потік після капітальних інвестицій. CAGR — середньорічний складений темп зростання. Разом це темп зростання FCF за 3 роки: (кінцевий FCF / початковий FCF)^(1/3) − 1.",
      importance: "Показує, чи генерує бізнес дедалі більше грошей для інвестицій, погашення боргу та виплат акціонерам. Доповнює бухгалтерський прибуток; великі капітальні витрати й від’ємна початкова база ускладнюють порівняння.",
    },
    forwardRevenue: {
      meaning: "Очікувана зміна виручки за прогнозними даними Yahoo Finance. «Прогноз» або forward означає майбутній, а не вже завершений період.",
      importance: "Допомагає оцінити, чи може бізнес підтримати зростання надалі. Це очікування, які можуть змінитися, тому модель поєднує їх з фактичною історією.",
    },
    forwardEarnings: {
      meaning: "Очікуваний темп зростання прибутку за прогнозними даними Yahoo Finance. Це оцінка майбутнього результату, а не вже отриманий прибуток.",
      importance: "Показує очікувану динаміку прибутковості та допомагає зіставити зростання з ціною акції. Прогнози можуть переглядатися й не гарантують результату.",
    },
    peMarket: { ...uk.pe, importance: "Тут P/E порівнюється зі SPY — біржовим фондом на індекс S&P 500. Це загальний ринковий орієнтир; різниця може пояснюватися сектором, темпом зростання та ризиками." },
    pePeers: { ...uk.pe, importance: "Порівняння з медіаною схожих компаній показує знижку або премію до конкурентів. Медіана — середнє за позицією значення впорядкованого набору, менш чутливе до окремих екстремальних значень." },
    forwardPe: { ...uk.pe, meaning: "Прогнозний P/E — ціна акції відносно очікуваного, а не минулого прибутку на акцію. Тут він порівнюється з медіаною прогнозного P/E конкурентів." },
    peHistory: { ...uk.pe, importance: "Порівняння з власною історичною медіаною показує, чи стала компанія дорожчою відносно свого прибутку. Зміни бізнесу або ризиків можуть обґрунтовувати новий рівень P/E." },
    psHistory: { ...uk.ps, importance: "Власна історія дає орієнтир того, скільки ринок раніше платив за продажі компанії. Знижку варто читати разом із маржами: нижча ціна може відображати нижчу прибутковість." },
    psPeers: uk.ps,
    pfcfHistory: {
      meaning: "P/FCF — ринкова капіталізація, поділена на річний вільний грошовий потік (FCF). FCF — операційний грошовий потік після капітальних інвестицій. Тут мультиплікатор порівнюється з власною історією компанії.",
      importance: "Показує ціну фактично згенерованих грошей. Доповнює P/E, коли прибуток і грошовий потік різняться; тимчасові зміни інвестицій або оборотного капіталу можуть спотворювати один рік.",
    },
    evPeers: {
      meaning: "EV (enterprise value) — вартість бізнесу з урахуванням боргу та грошових коштів. EBITDA — прибуток до відсотків, податків, зносу й амортизації. EV/EBITDA зіставляє ці дві величини.",
      importance: "Допомагає порівнювати оцінку компаній із різним борговим навантаженням. EBITDA не дорівнює вільному грошовому потоку, адже не враховує, зокрема, капітальних інвестицій.",
    },
    pbPeers: uk.pb,
    pb: uk.pb,
    income: {
      meaning: "Чистий прибуток — підсумковий фінансовий результат після операційних витрат, відсотків, податків та інших статей звіту про прибутки й збитки.",
      importance: "Показує, чи є бізнес прибутковим за правилами бухгалтерського обліку. Він може відрізнятися від грошей на рахунках, тому модель окремо перевіряє FCF.",
    },
    fcf: uk.fcf,
    revenuePeers: { meaning: "Річний темп зростання виручки порівнюється з медіаною доступних темпів конкурентів. Різниця вимірюється у відсоткових пунктах: 15% проти 10% — це +5 п.п.", importance: "Допомагає відокремити власну динаміку компанії від загального зростання галузі. Результат залежить від того, наскільки порівнювані вибрані конкуренти." },
    earningsPeers: { meaning: "Річний темп зростання прибутку порівнюється з медіаною темпів конкурентів. Порівняння показує різницю темпів, а не абсолютних сум прибутку.", importance: "Показує відносну динаміку прибутковості. Низька база та разові прибутки або збитки можуть створювати великі відсоткові зміни." },
    forwardPeers: { meaning: "Прогноз зростання виручки компанії порівнюється з доступною медіаною зростання виручки конкурентів. Прогноз компанії та дані конкурентів можуть належати до різних періодів.", importance: "Дає орієнтир очікуваного темпу щодо конкурентів. Через різницю періодів це наближене порівняння, яке слід читати разом з історичними темпами." },
    grossDelta: { ...uk.gross, meaning: `${uk.gross.meaning} Тут показано її зміну за 3 роки у відсоткових пунктах: з 40% до 45% — це +5 п.п.`, importance: "Зростання валової маржі може свідчити про сильніше ціноутворення, вигідніший асортимент або нижчу собівартість. Падіння може вказувати на тиск витрат чи конкуренції." },
    operatingDelta: { ...uk.operating, meaning: `${uk.operating.meaning} Тут оцінюється зміна за 3 роки у відсоткових пунктах.`, importance: "Допомагає побачити, чи стає основний бізнес ефективнішим із масштабом. Падіння маржі може означати тиск витрат або тимчасове збільшення інвестицій у розвиток." },
    netDelta: { ...uk.net, meaning: `${uk.net.meaning} Тут показано зміну маржі за 3 роки у відсоткових пунктах.`, importance: "Виявляє, чи залишається компанії більша частка продажів. На зміну впливають не лише операції, а й відсотки за боргом, податки та разові статті." },
    grossMargin: uk.gross,
    operatingMargin: uk.operating,
    profitMargin: uk.net,
    fcfMargin: { meaning: "Маржа FCF — вільний грошовий потік (операційний потік мінус капітальні інвестиції), поділений на виручку. Наприклад, 15% означає 15 одиниць вільних грошей на 100 одиниць продажів.", importance: "Показує, яка частина продажів перетворюється на гроші після інвестицій в основні активи. Допомагає перевірити якість прибутку та здатність бізнесу фінансувати себе." },
    marginPeers: { ...uk.net, importance: "Порівняння з медіаною конкурентів показує відносну прибутковість продажів. Різні податки, борг і разові статті можуть впливати на результат навіть у схожих компаній." },
    roePeers: { ...uk.roe, importance: "Порівняння з медіаною конкурентів допомагає оцінити відносну ефективність капіталу. Варто зіставляти також борг і розмір власного капіталу." },
    roe: uk.roe,
    roic: { meaning: "ROIC (return on invested capital) — рентабельність інвестованого капіталу. Тут використано наближення: операційний прибуток / (борг + власний капітал − грошові кошти), без поправки прибутку на податки.", importance: "Допомагає оцінити ефективність усього залученого капіталу. Позначка proxy означає наближену формулу, тому показник може відрізнятися від ROIC в інших джерелах." },
    debt: { meaning: "Борг / власний капітал (debt-to-equity) — співвідношення боргу до балансового капіталу акціонерів. Значення 1× означає однакові суми боргу і власного капіталу.", importance: "Показує залежність бізнесу від позикового фінансування. Високий борг може посилювати тиск відсоткових платежів; прийнятний рівень залежить від сектору." },
    netDebt: { meaning: "Чистий борг — борг мінус грошові кошти. Чистий борг / FCF порівнює його з річним вільним грошовим потоком. Від’ємне значення за додатного FCF означає, що грошей більше, ніж боргу.", importance: "Допомагає оцінити масштаб боргу відносно здатності генерувати гроші. Це не точний термін погашення: FCF змінюється і може використовуватися на інші цілі." },
    revenueFloor: { meaning: "Перевірка, чи виручка продовжує зростати. Модель використовує доступний річний темп, а за його відсутності — середньорічний складений темп (CAGR) за 3 роки.", importance: "Допомагає відрізнити стійку прибутковість від ситуації, коли маржі покращуються лише через скорочення бізнесу або витрат." },
    peg: { meaning: "PEG — P/E, поділений на темп зростання прибутку у відсотках. SBC (stock-based compensation) — винагорода працівникам акціями чи опціонами. Коли даних достатньо, модель коригує PEG на FCF після SBC.", importance: "Поєднує ціну, зростання та вартість винагороди акціями для акціонерів. Нижчий додатний PEG означає меншу ціну за одиницю зростання, але результат залежить від прогнозів і доступності поправки на SBC." },
    pegGrowth: { meaning: "Темп зростання прибутку, що використовується для розрахунку PEG. Модель бере прогноз зростання, а за його відсутності — CAGR прибутку за 3 роки.", importance: "Цей темп є знаменником PEG: вищий прогноз зменшує PEG за незмінного P/E. Завищені очікування можуть створювати враження дешевизни, тому важлива якість прогнозу." },
    sbcRevenue: { meaning: "SBC (stock-based compensation) — винагорода працівникам акціями або опціонами. SBC / виручка показує її розмір відносно продажів.", importance: "Допомагає оцінити масштаб винагороди акціями. Вона зберігає гроші компанії в короткому періоді, але може розмивати частку наявних акціонерів." },
    sbcFcf: { meaning: "SBC — винагорода акціями чи опціонами; FCF — вільний грошовий потік після капітальних інвестицій. SBC / FCF порівнює витрати на таку винагороду зі згенерованими грошима.", importance: "SBC як негрошова витрата додається назад у звіті про грошові потоки. Велика частка SBC допомагає пояснити, чому звітний FCF може переоцінювати економічну вигоду для акціонерів." },
    adjustedFcf: { meaning: "FCF після SBC — вільний грошовий потік мінус винагорода працівникам акціями або опціонами. Це аналітична поправка моделі, а не окрема грошова виплата.", importance: "Перевіряє, чи зберігається додатний результат після врахування економічної вартості винагороди акціями. Доповнює звітний FCF при оцінці якості бізнесу." },
  },
  en: {
    revenueCagr: { meaning: "Revenue is sales before expenses. CAGR (compound annual growth rate) is the steady annual growth rate between two values. Over 3 years: (ending revenue / starting revenue)^(1/3) − 1.", importance: "Shows the longer-term pace of business expansion. A 10% CAGR means growth from 100 to about 133 over 3 years, not necessarily exactly 10% in each year." },
    incomeCagr: { meaning: "Net income is profit after all expenses and taxes. CAGR is its compound annual growth rate over 3 years, calculated from the starting and ending values.", importance: "Helps show whether sales growth translates into profit. One-off effects and a low starting base can inflate growth; a transition from losses to profit is not described by ordinary CAGR." },
    fcfCagr: { meaning: "FCF (free cash flow) is operating cash flow after capital expenditure. CAGR is the compound annual growth rate. Together, this measures 3-year FCF growth: (ending FCF / starting FCF)^(1/3) − 1.", importance: "Shows whether the business generates increasing cash for investment, debt repayment, and shareholder distributions. It complements accounting profit; major capital expenditure and a negative starting base complicate comparisons." },
    forwardRevenue: { meaning: "Expected revenue growth using Yahoo Finance forecast data. “Forward” refers to a future period rather than a completed one.", importance: "Helps assess whether the business may sustain growth. Expectations can change, so the model combines them with actual historical results." },
    forwardEarnings: { meaning: "Expected earnings growth using Yahoo Finance forecast data. This estimates future performance rather than profit already earned.", importance: "Relates expected profitability growth to the share price. Forecasts can be revised and do not guarantee the outcome." },
    peMarket: { ...en.pe, importance: "Here, P/E is compared with SPY, an exchange-traded fund tracking the S&P 500. It is a broad market benchmark; sector, growth, and risk differences can explain the gap." },
    pePeers: { ...en.pe, importance: "Comparison with the median of similar companies shows a discount or premium to peers. The median is the middle value of an ordered set and is less sensitive to individual extreme values." },
    forwardPe: { ...en.pe, meaning: "Forward P/E relates the share price to expected rather than past earnings per share. Here, it is compared with the median forward P/E of peers." },
    peHistory: { ...en.pe, importance: "Comparison with the company’s own historical median shows whether it has become more expensive relative to its earnings. Business or risk changes can justify a different P/E." },
    psHistory: { ...en.ps, importance: "The company’s history indicates what the market previously paid for its sales. Read discounts alongside margins: a lower valuation may reflect lower profitability." },
    psPeers: en.ps,
    pfcfHistory: { meaning: "P/FCF is market capitalization divided by annual free cash flow. FCF is operating cash flow after capital expenditure. Here, the multiple is compared with the company’s own history.", importance: "Measures the price of cash actually generated. It complements P/E when profit and cash flow diverge; temporary changes in investment or working capital can distort a single year." },
    evPeers: { meaning: "EV (enterprise value) measures business value including debt and cash. EBITDA is earnings before interest, taxes, depreciation, and amortization. EV/EBITDA relates these two values.", importance: "Helps compare valuations across companies with different debt levels. EBITDA is not free cash flow: it excludes capital expenditure, among other items." },
    pbPeers: en.pb,
    pb: en.pb,
    income: { meaning: "Net income is the final accounting result after operating expenses, interest, taxes, and other income statement items.", importance: "Shows whether the business earns an accounting profit. It can differ from cash generated, so the model separately checks FCF." },
    fcf: en.fcf,
    revenuePeers: { meaning: "Annual revenue growth is compared with the median available peer growth rate. The difference is measured in percentage points: 15% versus 10% is +5 pp.", importance: "Helps distinguish company-specific momentum from overall industry growth. Results depend on how comparable the selected peers are." },
    earningsPeers: { meaning: "Annual earnings growth is compared with the median peer growth rate. This compares growth rates rather than absolute amounts of profit.", importance: "Shows relative profitability trends. A low starting base and one-off profits or losses can produce large percentage changes." },
    forwardPeers: { meaning: "The company’s revenue growth forecast is compared with the available median peer revenue growth rate. The forecast and peer data may refer to different periods.", importance: "Provides a reference for expected growth relative to peers. Because periods may differ, this is an approximate comparison to read alongside historical growth." },
    grossDelta: { ...en.gross, meaning: `${en.gross.meaning} Here, its 3-year change is measured in percentage points: 40% to 45% is +5 pp.`, importance: "Rising gross margins can reflect stronger pricing, a better product mix, or lower production costs. Falling margins may indicate cost or competitive pressure." },
    operatingDelta: { ...en.operating, meaning: `${en.operating.meaning} Here, its 3-year change is measured in percentage points.`, importance: "Helps show whether the core business becomes more efficient as it scales. Falling margins may reflect cost pressure or temporarily higher investment in growth." },
    netDelta: { ...en.net, meaning: `${en.net.meaning} Here, its 3-year change is measured in percentage points.`, importance: "Shows whether the company retains a larger share of sales. Interest, taxes, and one-off items can affect the change as well as operating performance." },
    grossMargin: en.gross,
    operatingMargin: en.operating,
    profitMargin: en.net,
    fcfMargin: { meaning: "FCF margin is free cash flow (operating cash flow minus capital expenditure) divided by revenue. For example, 15% means 15 units of free cash for every 100 units of sales.", importance: "Shows how much revenue becomes cash after investment in fixed assets. Helps assess profit quality and the business’s ability to fund itself." },
    marginPeers: { ...en.net, importance: "Comparison with the peer median shows relative profitability of sales. Taxes, debt, and one-off items can influence the result even for similar businesses." },
    roePeers: { ...en.roe, importance: "Comparison with the peer median helps assess relative capital efficiency. Debt and the size of the equity base should also be compared." },
    roe: en.roe,
    roic: { meaning: "ROIC (return on invested capital) measures capital efficiency. This model uses a proxy: operating profit / (debt + equity − cash), without adjusting operating profit for taxes.", importance: "Helps assess returns on all capital employed. “Proxy” means an approximation, so it may differ from ROIC reported by other sources." },
    debt: { meaning: "Debt-to-equity is debt divided by book shareholders’ equity. A value of 1× means equal amounts of debt and equity.", importance: "Shows reliance on borrowed funding. High debt can increase interest payment pressure; appropriate levels depend on the sector." },
    netDebt: { meaning: "Net debt is debt minus cash. Net debt / FCF compares it with annual free cash flow. A negative ratio with positive FCF means cash exceeds debt.", importance: "Relates debt to cash-generating capacity. It is not an exact repayment period: FCF changes and may be used for other purposes." },
    revenueFloor: { meaning: "Checks whether revenue is still growing. The model uses available annual growth, falling back to the 3-year compound annual growth rate (CAGR).", importance: "Helps distinguish resilient profitability from margins improving only through a shrinking business or cost cuts." },
    peg: { meaning: "PEG is P/E divided by earnings growth expressed as a percentage. SBC (stock-based compensation) pays employees in shares or options. When sufficient data is available, the model adjusts PEG using FCF after SBC.", importance: "Combines valuation, growth, and the cost of equity compensation to shareholders. A lower positive PEG means paying less per unit of growth, but depends on forecasts and whether the SBC adjustment is available." },
    pegGrowth: { meaning: "The earnings growth rate used to calculate PEG. The model uses forecast growth, falling back to the 3-year earnings CAGR if no forecast is available.", importance: "This is PEG’s denominator: a higher growth forecast lowers PEG at the same P/E. Overoptimistic expectations can make a stock appear cheap, so forecast quality matters." },
    sbcRevenue: { meaning: "SBC (stock-based compensation) pays employees in shares or options. SBC / revenue measures this compensation relative to sales.", importance: "Helps assess the scale of equity compensation. It preserves company cash in the short term but may dilute existing shareholders’ ownership." },
    sbcFcf: { meaning: "SBC is compensation in shares or options; FCF is free cash flow after capital expenditure. SBC / FCF compares this compensation cost with cash generated.", importance: "SBC is added back as a non-cash expense in the cash flow statement. A large SBC share helps explain why reported FCF may overstate the economic benefit to shareholders." },
    adjustedFcf: { meaning: "FCF after SBC is free cash flow minus stock-based compensation. This is the model’s analytical adjustment, not a separate cash payment.", importance: "Checks whether a positive result remains after accounting for the economic cost of equity compensation. It complements reported FCF when assessing business quality." },
  },
} satisfies Record<Language, Record<SignalKey, SignalExplanation>>;

// Resolve the labels already returned by the API, including cached analyses.
const signalKeysByLabel = new Map<string, SignalKey>(
  Object.values(signalLabels).flatMap((labels) =>
    (Object.entries(labels) as [SignalKey, string][]).map(([key, label]) => [label, key]),
  ),
);

export function explanationForSignal(label: string, language: Language): SignalExplanation | undefined {
  const key = signalKeysByLabel.get(label);
  return key ? signalExplanations[language][key] : undefined;
}
