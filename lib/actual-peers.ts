const ACTUAL_PEERS_CACHE_TTL_MS = 60 * 60 * 1000;
const ACTUAL_PEERS_ERROR_TTL_MS = 5 * 60 * 1000;

type ActualPeersCache = {
  sourceUrl: string;
  expiresAt: number;
  peerGroups: Map<string, string[]>;
};

let actualPeersCache: ActualPeersCache | undefined;
let actualPeersRequest: Promise<Map<string, string[]>> | undefined;

export async function getActualPeerSymbols(inputTicker: string) {
  const sourceUrl = process.env.ACTUAL_PEERS?.trim();
  if (!sourceUrl) return [];

  const groups = await loadActualPeerGroups(sourceUrl);
  return groups.get(normalizeTicker(inputTicker)) ?? [];
}

async function loadActualPeerGroups(sourceUrl: string) {
  const now = Date.now();
  if (actualPeersCache?.sourceUrl === sourceUrl && actualPeersCache.expiresAt > now) {
    return actualPeersCache.peerGroups;
  }

  if (actualPeersRequest) {
    return actualPeersRequest;
  }

  actualPeersRequest = fetchActualPeerGroups(sourceUrl);

  try {
    return await actualPeersRequest;
  } finally {
    actualPeersRequest = undefined;
  }
}

async function fetchActualPeerGroups(sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "text/csv,text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`ACTUAL_PEERS responded with HTTP ${response.status}`);
    }

    const csv = await response.text();
    const peerGroups = parseActualPeersCsv(csv);
    actualPeersCache = {
      sourceUrl,
      peerGroups,
      expiresAt: Date.now() + ACTUAL_PEERS_CACHE_TTL_MS,
    };
    return peerGroups;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "ACTUAL_PEERS could not be loaded.");
    const peerGroups = new Map<string, string[]>();
    actualPeersCache = {
      sourceUrl,
      peerGroups,
      expiresAt: Date.now() + ACTUAL_PEERS_ERROR_TTL_MS,
    };
    return peerGroups;
  }
}

function parseActualPeersCsv(csv: string) {
  const rows = parseCsvRows(csv);
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const tickerIndex = firstHeaderIndex(headers, ["ticker", "ticket", "symbol"]);
  const peersIndex = headers.indexOf("peers");
  const peerGroups = new Map<string, string[]>();

  if (tickerIndex < 0 || peersIndex < 0) {
    return peerGroups;
  }

  for (const row of rows.slice(1)) {
    const symbol = normalizeTicker(row[tickerIndex] ?? "");
    if (!symbol) continue;

    const peers = normalizePeerSymbols(parsePeerList(row[peersIndex] ?? ""), symbol);
    if (peers.length) {
      peerGroups.set(symbol, peers);
    }
  }

  return peerGroups;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];

    if (inQuotes) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    if (char === "\r") {
      if (csv[index + 1] === "\n") {
        continue;
      }

      pushRow();
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    pushRow();
  }

  return rows;
}

function parsePeerList(value: string) {
  return value
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function firstHeaderIndex(headers: string[], names: string[]) {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }

  return -1;
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(".", "-").slice(0, 16);
}

function normalizePeerSymbols(values: string[], baseSymbol: string) {
  return Array.from(new Set(values.map(normalizeTicker).filter(Boolean)))
    .filter((symbol) => symbol !== baseSymbol)
    .slice(0, 8);
}
