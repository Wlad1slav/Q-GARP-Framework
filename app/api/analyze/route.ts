import { NextResponse } from "next/server";
import { analyzeTicker } from "@/lib/finance-analysis";
import { analysisCopy, normalizeLanguage } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const peers = parsePeers(searchParams.get("peers"));
  const language = normalizeLanguage(searchParams.get("lang"));

  try {
    const result = await analyzeTicker(ticker, peers, language);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
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
