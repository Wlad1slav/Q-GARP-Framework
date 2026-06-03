import { NextResponse } from "next/server";
import { getSp500Constituents } from "@/lib/sp500";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getSp500Constituents();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load S&P 500 constituents.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
