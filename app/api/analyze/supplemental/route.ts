import { NextResponse } from "next/server";
import { ANALYSIS_CACHE_TTL_SECONDS } from "@/lib/analysis-service";
import type { SupplementalMetricId } from "@/lib/analysis-types";
import { analysisCopy, normalizeLanguage } from "@/lib/i18n";
import { getSupplementalMetrics, isSupplementalMetricId } from "@/lib/supplemental-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const language = normalizeLanguage(searchParams.get("lang"));

  try {
    const metrics = parseMetrics(searchParams.get("metric") ?? searchParams.get("metrics"));
    const result = await getSupplementalMetrics(ticker, language, "single", metrics);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `private, max-age=${ANALYSIS_CACHE_TTL_SECONDS}, stale-while-revalidate=600`,
        "X-Analysis-Priority": "single",
        "X-Supplemental-Metrics": "1",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : analysisCopy[language].errors.fetchTicker;
    return NextResponse.json({ message }, { status: 400 });
  }
}

function parseMetrics(value: string | null): SupplementalMetricId[] | undefined {
  if (!value) return undefined;

  const metrics = value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!metrics.length) return undefined;

  const invalid = metrics.find((metric) => !isSupplementalMetricId(metric));
  if (invalid) {
    throw new Error(`Unknown supplemental metric: ${invalid}`);
  }

  return Array.from(new Set(metrics)) as SupplementalMetricId[];
}
