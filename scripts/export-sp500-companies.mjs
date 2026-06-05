#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import YahooFinance from "yahoo-finance2";

const SP500_SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const DEFAULT_OUTPUT_FILE = "sp500-companies.csv";
const MIN_EXPECTED_COMPANIES = 450;
const MAX_YAHOO_PEERS = 8;
const YAHOO_CONCURRENCY = 2;
const YAHOO_MIN_START_INTERVAL_MS = 650;
const YAHOO_RETRY_DELAYS_MS = [3500, 8000, 15000, 24000];

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const outputFile = path.resolve(process.cwd(), cliArgs.outputFile ?? DEFAULT_OUTPUT_FILE);

  const response = await fetch(SP500_SOURCE_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Q-GARP Framework S&P 500 CSV exporter",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load S&P 500 companies: ${response.status}`);
  }

  const html = await response.text();
  const parsedCompanies = parseSp500Companies(html);

  if (parsedCompanies.length < MIN_EXPECTED_COMPANIES) {
    throw new Error(`S&P 500 company table was not parsed correctly. Found ${parsedCompanies.length} rows.`);
  }

  const companiesToExport = cliArgs.limit ? parsedCompanies.slice(0, cliArgs.limit) : parsedCompanies;
  const { companies, failures } = await loadYahooPeerGroups(companiesToExport);
  const csv = toCsv(companies);

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, csv, "utf8");

  console.log(`Exported ${companies.length} S&P 500 companies to ${outputFile}`);
  if (failures.length) {
    console.warn(`Yahoo peers were not available for ${failures.length} tickers: ${failures.slice(0, 12).join(", ")}`);
  }
}

function parseSp500Companies(html) {
  const table = html.match(/<table[^>]*id=["']constituents["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];

  return Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((row) => Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) => cleanCell(cell[1])))
    .filter((cells) => cells.length >= 4 && cells[0] !== "Symbol")
    .map((cells) => ({
      name: cells[1],
      ticket: normalizeTicker(cells[0]),
      sector: cells[2],
      subIndustry: cells[3],
    }))
    .filter((company) => company.name && company.ticket);
}

async function loadYahooPeerGroups(companies) {
  const failures = [];
  let completed = 0;

  const enrichedCompanies = await mapLimit(companies, YAHOO_CONCURRENCY, async (company) => {
    const yahooPeers = await getYahooPeerSymbols(company.ticket).catch(() => {
      failures.push(company.ticket);
      return [];
    });

    completed += 1;
    if (completed % 25 === 0 || completed === companies.length) {
      console.log(`Loaded Yahoo peer groups for ${completed}/${companies.length} companies`);
    }

    return {
      ...company,
      yahooPeers,
    };
  });

  return {
    companies: enrichedCompanies,
    failures,
  };
}

async function getYahooPeerSymbols(symbol) {
  const result = await runYahooRequest(() =>
    yahooFinance.recommendationsBySymbol(symbol, {}, { validateResult: false }),
  );
  const rows = Array.isArray(result?.recommendedSymbols) ? result.recommendedSymbols : [];

  return Array.from(
    new Set(
      rows
        .map((item) => (item && typeof item.symbol === "string" ? normalizeTicker(item.symbol) : ""))
        .filter((peerSymbol) => peerSymbol && peerSymbol !== symbol),
    ),
  ).slice(0, MAX_YAHOO_PEERS);
}

function toCsv(companies) {
  const rows = companies.map((company) =>
    [company.name, company.ticket, company.sector, company.subIndustry, company.yahooPeers.join("|")].map(csvField).join(","),
  );
  return ["name,ticket,sector,sub_industry,yahoo_peers", ...rows].join("\n") + "\n";
}

function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeTicker(value) {
  return value.trim().toUpperCase().replace(".", "-").replace(/\s+/g, "");
}

async function runYahooRequest(run) {
  await waitForYahooStartSlot();

  let lastError;
  for (let attempt = 0; attempt <= YAHOO_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableYahooError(error) || attempt >= YAHOO_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await delay(YAHOO_RETRY_DELAYS_MS[attempt]);
      await waitForYahooStartSlot();
    }
  }

  throw lastError;
}

let nextYahooStartAt = 0;

async function waitForYahooStartSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextYahooStartAt - now);
  nextYahooStartAt = Math.max(now, nextYahooStartAt) + YAHOO_MIN_START_INTERVAL_MS;

  if (waitMs > 0) {
    await delay(waitMs);
  }
}

function isRetryableYahooError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|too many requests|rate.?limit|econnreset|etimedout|fetch failed/i.test(message);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseCliArgs(args) {
  const parsed = {
    outputFile: undefined,
    limit: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--limit") {
      parsed.limit = parseLimit(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (parsed.outputFile && parsed.limit === undefined && /^\d+$/.test(arg)) {
      parsed.limit = parseLimit(arg);
      continue;
    }

    if (parsed.outputFile) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    parsed.outputFile = arg;
  }

  return parsed;
}

function parseLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }

  return limit;
}

function cleanCell(value) {
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

function decodeHtmlEntities(value) {
  const named = {
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
