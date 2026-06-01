import { NextResponse } from "next/server";
import { analyzeTicker } from "@/lib/finance-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const peers = parsePeers(searchParams.get("peers"));

  try {
    const result = await analyzeTicker(ticker, peers);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося отримати дані по тікеру.";
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
