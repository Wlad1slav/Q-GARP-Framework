export interface Sp500Constituent {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
}

export interface Sp500ConstituentResponse {
  constituents: Sp500Constituent[];
  asOf: string;
  sourceName: string;
  sourceUrl: string;
}

const SP500_SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_SP500_SYMBOLS = new Set(["GOOG"]);

let cachedConstituents: { value: Sp500ConstituentResponse; expiresAt: number } | undefined;

export async function getSp500Constituents(): Promise<Sp500ConstituentResponse> {
  const now = Date.now();
  if (cachedConstituents && cachedConstituents.expiresAt > now) {
    return cachedConstituents.value;
  }

  const response = await fetch(SP500_SOURCE_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Q-GARP Framework S&P 500 scanner",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load S&P 500 constituents: ${response.status}`);
  }

  const html = await response.text();
  const constituents = parseSp500Constituents(html);

  if (constituents.length < 450) {
    throw new Error("S&P 500 constituent table was not parsed correctly.");
  }

  const value = {
    constituents,
    asOf: new Date().toISOString(),
    sourceName: "Wikipedia",
    sourceUrl: SP500_SOURCE_URL,
  };

  cachedConstituents = {
    value,
    expiresAt: now + CACHE_TTL_MS,
  };

  return value;
}

function parseSp500Constituents(html: string) {
  const table = html.match(/<table[^>]*id=["']constituents["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];

  return Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((row) => Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) => cleanCell(cell[1])))
    .filter((cells) => cells.length >= 4 && cells[0] !== "Symbol")
    .map((cells) => ({
      symbol: normalizeSymbol(cells[0]),
      name: cells[1],
      sector: cells[2],
      industry: cells[3],
    }))
    .filter((item) => item.symbol && item.name && !EXCLUDED_SP500_SYMBOLS.has(item.symbol));
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(".", "-").replace(/\s+/g, "");
}

function cleanCell(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<sup[\s\S]*?<\/sup>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "...",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: '"',
    rsquo: "'",
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}
