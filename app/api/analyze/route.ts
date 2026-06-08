import { NextResponse } from "next/server";
import { ANALYSIS_CACHE_TTL_SECONDS, getCachedAnalysis } from "@/lib/analysis-service";
import { parseSectorWeightsFlag, SECTOR_WEIGHTS_QUERY_PARAM } from "@/lib/analysis-settings";
import { analysisCopy, normalizeLanguage } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const peers = parsePeers(searchParams.get("peers"));
  const language = normalizeLanguage(searchParams.get("lang"));
  const useSectorWeights = parseSectorWeightsFlag(searchParams.get(SECTOR_WEIGHTS_QUERY_PARAM));

  try {
    const { result, cached } = await getCachedAnalysis({
      ticker,
      peers,
      language,
      priority: "single",
      options: {
        useSectorWeights,
      },
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `private, max-age=${ANALYSIS_CACHE_TTL_SECONDS}, stale-while-revalidate=600`,
        "X-Analysis-Cache": cached ? "hit" : "miss",
        "X-Analysis-Priority": "single",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : analysisCopy[language].errors.fetchTicker;
    return NextResponse.json({ message }, { status: 400 });
  }
}

function parsePeers(value: string | null) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
