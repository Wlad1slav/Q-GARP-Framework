export type AnalysisSettings = {
  useSectorWeights: boolean;
};

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  useSectorWeights: true,
};

export const APP_SETTINGS_STORAGE_KEY = "invest-rate.settings.v1";
export const SP500_TOP_SETTINGS_STORAGE_KEY = "invest-rate.sp500-top.settings.v1";

export const SECTOR_WEIGHTS_QUERY_PARAM = "sectorWeights";

export function readAnalysisSettings(storageKey: string): AnalysisSettings {
  if (typeof window === "undefined") return DEFAULT_ANALYSIS_SETTINGS;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return normalizeAnalysisSettings(raw ? JSON.parse(raw) : undefined);
  } catch {
    return DEFAULT_ANALYSIS_SETTINGS;
  }
}

export function writeAnalysisSettings(storageKey: string, settings: AnalysisSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(normalizeAnalysisSettings(settings)));
}

export function parseSectorWeightsFlag(value: string | null | undefined) {
  if (value === null || value === undefined) return DEFAULT_ANALYSIS_SETTINGS.useSectorWeights;

  const normalized = value.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;

  return DEFAULT_ANALYSIS_SETTINGS.useSectorWeights;
}

export function sectorWeightsSearchParam(useSectorWeights: boolean) {
  return useSectorWeights ? "1" : "0";
}

export function sectorWeightsCacheToken(useSectorWeights: boolean) {
  return useSectorWeights ? "sector-weights" : "baseline-weights";
}

function normalizeAnalysisSettings(value: unknown): AnalysisSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_ANALYSIS_SETTINGS;
  }

  const rawSettings = value as Partial<AnalysisSettings>;

  return {
    useSectorWeights:
      typeof rawSettings.useSectorWeights === "boolean"
        ? rawSettings.useSectorWeights
        : DEFAULT_ANALYSIS_SETTINGS.useSectorWeights,
  };
}
