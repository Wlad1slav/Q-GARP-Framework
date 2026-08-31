export type PortfolioImportSource = "yahoo" | "revolut" | "ibkr" | "example";

export type ImportedPortfolioPosition = {
  symbol: string;
  quantity: number;
  fallbackPrice?: number;
  currency?: string;
  reportedValue?: number;
  fxToBase?: number;
  name?: string;
};

export type ImportedPortfolioCash = {
  currency: string;
  amount: number;
  fxToBase?: number;
};

export type ParsedPortfolio = {
  source: PortfolioImportSource;
  positions: ImportedPortfolioPosition[];
  cash: ImportedPortfolioCash[];
  baseCurrency: string;
  asOf?: string;
  warnings: string[];
};

type CsvRecord = Record<string, string>;

export function parsePortfolioCsv(text: string): ParsedPortfolio {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (!rows.length) throw new Error("CSV-файл порожній.");

  const firstHeader = rows[0].map(normalizeHeader);

  if (firstHeader.includes("currentprice") && firstHeader.includes("transactiontype")) {
    return parseYahoo(rows);
  }

  if (
    firstHeader.includes("ticker") &&
    firstHeader.includes("pricepershare") &&
    firstHeader.includes("totalamount") &&
    firstHeader.includes("fxrate")
  ) {
    return parseRevolut(rows);
  }

  if (looksLikeIbkr(rows, firstHeader)) {
    return parseIbkr(rows);
  }

  throw new Error("Формат не розпізнано. Підтримуються Yahoo Portfolio, Revolut та IBKR Activity Statement/Flex Query CSV.");
}

export function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

function parseYahoo(rows: string[][]): ParsedPortfolio {
  const records = rowsToRecords(rows);
  const quantities = new Map<string, number>();
  const prices = new Map<string, number>();
  const dates: string[] = [];
  const hasTransactions = records.some((record) => getField(record, "Transaction Type").trim());

  for (const record of records) {
    const symbol = normalizeSymbol(getField(record, "Symbol"));
    if (!symbol) continue;

    const price = parseNumber(getField(record, "Current Price"));
    if (isFinitePositive(price)) prices.set(symbol, price);

    const date = normalizeDate(getField(record, "Date"));
    if (date) dates.push(date);

    const quantity = parseNumber(getField(record, "Quantity"));
    if (!Number.isFinite(quantity) || quantity === 0) continue;

    const transactionType = getField(record, "Transaction Type").toUpperCase();
    if (hasTransactions && !transactionType) continue;
    const direction = transactionType.includes("SELL") ? -1 : 1;
    quantities.set(symbol, (quantities.get(symbol) ?? 0) + Math.abs(quantity) * direction);
  }

  const positions = Array.from(quantities, ([symbol, quantity]) => ({
    symbol,
    quantity: cleanQuantity(quantity),
    fallbackPrice: prices.get(symbol),
    currency: inferYahooCurrency(symbol),
  })).filter((position) => position.quantity > 1e-8);

  if (!positions.length) {
    throw new Error("У Yahoo CSV не знайдено відкритих позицій після врахування BUY/SELL.");
  }

  return {
    source: "yahoo",
    positions,
    cash: [],
    baseCurrency: "USD",
    asOf: latestDate(dates),
    warnings: positions.some((position) => position.currency !== "USD")
      ? ["Yahoo не експортує валюту позиції — її визначено за біржовим суфіксом і буде уточнено через котирування."]
      : [],
  };
}

function parseRevolut(rows: string[][]): ParsedPortfolio {
  const records = rowsToRecords(rows);
  const quantities = new Map<string, number>();
  const latestPrices = new Map<string, { price: number; currency: string; fxToBase?: number; date: string }>();
  const cashByCurrency = new Map<string, number>();
  const fxSamples = new Map<string, number[]>();
  const baseCurrencyCounts = new Map<string, number>();
  const dates: string[] = [];

  for (const record of records) {
    const type = getField(record, "Type").toUpperCase();
    const symbol = normalizeSymbol(getField(record, "Ticker"));
    const currency = normalizeCurrency(getField(record, "Currency")) || currencyFromAmount(getField(record, "Total Amount")) || "USD";
    const quantity = parseNumber(getField(record, "Quantity"));
    const price = parseAmount(getField(record, "Price per share"));
    const totalAmount = parseAmount(getField(record, "Total Amount"));
    const fxRate = parseNumber(getField(record, "FX Rate"));
    const date = normalizeDate(getField(record, "Date"));

    if (date) dates.push(date);
    if (isFinitePositive(fxRate)) {
      const samples = fxSamples.get(currency) ?? [];
      samples.push(fxRate);
      fxSamples.set(currency, samples);
      if (Math.abs(fxRate - 1) < 0.00001) {
        baseCurrencyCounts.set(currency, (baseCurrencyCounts.get(currency) ?? 0) + 1);
      }
    }

    if (symbol && Number.isFinite(quantity) && quantity !== 0 && (type.includes("BUY") || type.includes("SELL"))) {
      const direction = type.includes("SELL") ? -1 : 1;
      quantities.set(symbol, (quantities.get(symbol) ?? 0) + Math.abs(quantity) * direction);

      const current = latestPrices.get(symbol);
      if (isFinitePositive(price) && (!current || date >= current.date)) {
        latestPrices.set(symbol, {
          price,
          currency,
          fxToBase: isFinitePositive(fxRate) ? 1 / fxRate : undefined,
          date,
        });
      }
    }

    if (!Number.isFinite(totalAmount)) continue;
    let cashDelta = totalAmount;
    if (type.includes("BUY")) cashDelta = -Math.abs(totalAmount);
    if (type.includes("SELL")) cashDelta = Math.abs(totalAmount);
    cashByCurrency.set(currency, (cashByCurrency.get(currency) ?? 0) + cashDelta);
  }

  const baseCurrency = mostFrequentKey(baseCurrencyCounts) ?? "EUR";
  const averageFx = new Map(
    Array.from(fxSamples, ([currency, samples]) => [currency, samples.reduce((sum, value) => sum + value, 0) / samples.length]),
  );
  const positions = Array.from(quantities, ([symbol, quantity]) => {
    const market = latestPrices.get(symbol);
    return {
      symbol,
      quantity: cleanQuantity(quantity),
      fallbackPrice: market?.price,
      currency: market?.currency,
      fxToBase: market?.fxToBase,
    };
  }).filter((position) => position.quantity > 1e-8);
  const cash = Array.from(cashByCurrency, ([currency, amount]) => ({
    currency,
    amount: cleanMoney(amount),
    fxToBase: currency === baseCurrency ? 1 : averageFx.get(currency) ? 1 / (averageFx.get(currency) as number) : undefined,
  })).filter((item) => Math.abs(item.amount) > 0.005);

  if (!positions.length) {
    throw new Error("У Revolut CSV не знайдено відкритих позицій після врахування BUY/SELL.");
  }

  return {
    source: "revolut",
    positions,
    cash,
    baseCurrency,
    asOf: latestDate(dates),
    warnings: ["Залишок cash розраховано з повної історії операцій; для часткового експорту він може бути неточним."],
  };
}

function parseIbkr(rows: string[][]): ParsedPortfolio {
  const baseCurrency = findIbkrBaseCurrency(rows) ?? "USD";
  const sectionHeaders = new Map<string, string[]>();
  const openPositionRecords: CsvRecord[] = [];
  const tradeRecords: CsvRecord[] = [];
  const cashCandidates: Array<{ currency: string; amount: number; baseSummary: boolean }> = [];
  const dates: string[] = [];

  for (const row of rows) {
    const section = normalizeHeader(row[0] ?? "");
    const recordType = normalizeHeader(row[1] ?? "");
    if (recordType === "header") {
      sectionHeaders.set(section, row.slice(2));
      continue;
    }
    if (recordType !== "data") continue;

    const headers = sectionHeaders.get(section);
    const record = headers ? recordFromCells(headers, row.slice(2)) : {};
    const reportDate = normalizeDate(findField(record, ["Report Date", "Date"]));
    if (reportDate) dates.push(reportDate);

    if (section === "openpositions" || section === "longopenpositions" || section === "shortopenpositions") {
      openPositionRecords.push(record);
    }
    if (section === "trades") tradeRecords.push(record);

    if (section === "cashreport") {
      const label = findField(record, ["Currency Summary", "Field Name", "Type"]) || row[2] || "";
      if (normalizeHeader(label) !== "endingcash") continue;
      const currencyLabel = findField(record, ["Currency"]) || row[3] || baseCurrency;
      const amount = parseNumber(findField(record, ["Total", "Amount", "Ending Cash"]) || row[4]);
      if (Number.isFinite(amount)) {
        cashCandidates.push({
          currency: normalizeCurrency(currencyLabel) || baseCurrency,
          amount,
          baseSummary: /base currency summary/i.test(currencyLabel),
        });
      }
    }
  }

  let positionRecords = openPositionRecords;
  let usedTradeFallback = false;

  if (!positionRecords.length && looksLikeFlatIbkr(rows[0])) {
    const records = rowsToRecords(rows);
    if (rows[0].some((header) => /position\s*value|mark\s*price|cost\s*basis\s*money/i.test(header))) {
      positionRecords = records;
    } else {
      tradeRecords.push(...records);
    }
  }

  let positions = positionsFromIbkrOpenRecords(positionRecords);
  if (!positions.length && tradeRecords.length) {
    positions = positionsFromIbkrTrades(tradeRecords);
    usedTradeFallback = positions.length > 0;
  }
  if (!positions.length) {
    throw new Error("В IBKR CSV не знайдено позицій. Експортуйте Activity Statement із секцією Open Positions або Flex Query з позиціями.");
  }

  const baseCash = cashCandidates.find((item) => item.baseSummary);
  const cash = baseCash
    ? [{ currency: baseCurrency, amount: baseCash.amount, fxToBase: 1 }]
    : mergeCash(cashCandidates.map(({ currency, amount }) => ({ currency, amount })));
  const warnings = [
    "IBKR: для найточнішого результату використовуйте statement на поточну дату із секціями Open Positions та Cash Report.",
  ];
  if (usedTradeFallback) warnings.push("Open Positions не знайдено — позиції відновлено з Trades; corporate actions можуть потребувати ручної перевірки.");
  if (positions.some((position) => position.quantity < 0)) warnings.push("Short-позиції збережено в таблиці, але не включено до кругової діаграми алокації.");

  return {
    source: "ibkr",
    positions,
    cash,
    baseCurrency,
    asOf: latestDate(dates),
    warnings,
  };
}

function positionsFromIbkrOpenRecords(records: CsvRecord[]): ImportedPortfolioPosition[] {
  const candidates = records.map((record) => ({
    record,
    detail: normalizeHeader(findField(record, ["DataDiscriminator", "Level of Detail", "LevelOfDetail"])),
  }));
  const summaries = candidates.filter(({ detail }) => detail === "summary");
  const selected = summaries.length ? summaries : candidates.filter(({ detail }) => detail !== "lot");
  const bySymbol = new Map<string, ImportedPortfolioPosition>();

  for (const { record } of selected) {
    const symbol = normalizeSymbol(findField(record, ["Symbol", "Underlying Symbol"]));
    const quantity = parseNumber(findField(record, ["Quantity", "Position"]));
    if (!symbol || !Number.isFinite(quantity) || quantity === 0) continue;
    const price = parseNumber(findField(record, ["Mark Price", "Close Price", "Cost Price"]));
    const value = parseNumber(findField(record, ["Position Value", "Value"]));
    const currency = normalizeCurrency(findField(record, ["Currency"]));
    const fx = parseNumber(findField(record, ["FX Rate to Base", "FXRateToBase"]));
    const current = bySymbol.get(symbol);

    bySymbol.set(symbol, {
      symbol,
      quantity: cleanQuantity((current?.quantity ?? 0) + quantity),
      fallbackPrice: isFinitePositive(price) ? price : current?.fallbackPrice,
      reportedValue: Number.isFinite(value) ? (current?.reportedValue ?? 0) + value : current?.reportedValue,
      currency: currency || current?.currency,
      fxToBase: isFinitePositive(fx) ? fx : current?.fxToBase,
      name: findField(record, ["Description"]) || current?.name,
    });
  }

  return Array.from(bySymbol.values()).filter((position) => Math.abs(position.quantity) > 1e-8);
}

function positionsFromIbkrTrades(records: CsvRecord[]): ImportedPortfolioPosition[] {
  const quantities = new Map<string, ImportedPortfolioPosition>();

  for (const record of records) {
    const symbol = normalizeSymbol(findField(record, ["Symbol"]));
    let quantity = parseNumber(findField(record, ["Quantity"]));
    if (!symbol || !Number.isFinite(quantity) || quantity === 0) continue;
    const side = findField(record, ["Buy/Sell", "Transaction Type"]).toUpperCase();
    if (side.includes("SELL")) quantity = -Math.abs(quantity);
    if (side.includes("BUY")) quantity = Math.abs(quantity);
    const current = quantities.get(symbol);
    const price = parseNumber(findField(record, ["Close Price", "Trade Price", "T. Price"]));
    quantities.set(symbol, {
      symbol,
      quantity: cleanQuantity((current?.quantity ?? 0) + quantity),
      fallbackPrice: isFinitePositive(price) ? price : current?.fallbackPrice,
      currency: normalizeCurrency(findField(record, ["Currency"])) || current?.currency,
      name: findField(record, ["Description"]) || current?.name,
    });
  }

  return Array.from(quantities.values()).filter((position) => position.quantity > 1e-8);
}

function looksLikeIbkr(rows: string[][], firstHeader: string[]) {
  if (rows.some((row) => /interactive brokers/i.test(row.join(" ")))) return true;
  if (rows.some((row) => ["openpositions", "cashreport", "accountinformation"].includes(normalizeHeader(row[0] ?? "")))) return true;
  return looksLikeFlatIbkr(firstHeader);
}

function looksLikeFlatIbkr(header: string[]) {
  const normalized = header.map(normalizeHeader);
  return normalized.includes("symbol") && normalized.includes("quantity") && (
    normalized.includes("assetclass") ||
    normalized.includes("conid") ||
    normalized.includes("ibcommission") ||
    normalized.includes("positionvalue") ||
    normalized.includes("markprice")
  );
}

function findIbkrBaseCurrency(rows: string[][]) {
  for (const row of rows) {
    for (let index = 0; index < row.length - 1; index += 1) {
      if (normalizeHeader(row[index]) === "basecurrency") {
        const currency = normalizeCurrency(row[index + 1]);
        if (currency) return currency;
      }
    }
  }
  return undefined;
}

function rowsToRecords(rows: string[][]) {
  const headers = rows[0];
  return rows.slice(1).map((row) => recordFromCells(headers, row));
}

function recordFromCells(headers: string[], cells: string[]) {
  const record: CsvRecord = {};
  headers.forEach((header, index) => {
    record[normalizeHeader(header)] = cells[index]?.trim() ?? "";
  });
  return record;
}

function getField(record: CsvRecord, header: string) {
  return record[normalizeHeader(header)] ?? "";
}

function findField(record: CsvRecord, headers: string[]) {
  for (const header of headers) {
    const value = getField(record, header);
    if (value !== "") return value;
  }
  return "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 32);
}

function normalizeCurrency(value: string) {
  const match = value.trim().toUpperCase().match(/\b[A-Z]{3}\b/);
  return match?.[0] ?? "";
}

function currencyFromAmount(value: string) {
  return normalizeCurrency(value);
}

function parseAmount(value: string) {
  return parseNumber(value.replace(/[A-Z]{3}|[$€£¥]/gi, "").trim());
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const trimmed = value.trim();
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()\s]/g, "").replace(/,/g, "").replace(/[^0-9.eE+\-]/g, "");
  const parsed = Number(cleaned);
  return negative ? -Math.abs(parsed) : parsed;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  const slashMatch = trimmed.match(/^(\d{4})[\/]([01]?\d)[\/]([0-3]?\d)/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoMatch?.[1] ?? "";
}

function latestDate(values: string[]) {
  return values.filter(Boolean).sort().at(-1);
}

function inferYahooCurrency(symbol: string) {
  if (/\.(AS|DE|F|PA|MI|MC|BR|VI|HE)$/i.test(symbol)) return "EUR";
  if (/\.L$/i.test(symbol)) return "GBP";
  if (/\.(TO|V)$/i.test(symbol)) return "CAD";
  if (/\.SW$/i.test(symbol)) return "CHF";
  return "USD";
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function cleanQuantity(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
}

function cleanMoney(value: number) {
  return Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2));
}

function mostFrequentKey(values: Map<string, number>) {
  return Array.from(values).sort((left, right) => right[1] - left[1])[0]?.[0];
}

function mergeCash(values: Array<{ currency: string; amount: number }>) {
  const merged = new Map<string, number>();
  for (const value of values) merged.set(value.currency, (merged.get(value.currency) ?? 0) + value.amount);
  return Array.from(merged, ([currency, amount]) => ({ currency, amount: cleanMoney(amount) }));
}
