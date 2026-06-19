import { supplementalMetricIds, type SupplementalMetricId } from "./analysis-types";
import { readBrowserStorageItem, writeBrowserStorageItem } from "./browser-storage";

export type SupplementalMetricSettings = Record<SupplementalMetricId, boolean>;

export type AnalysisSettings = {
  useSectorWeights: boolean;
  supplementalMetrics: SupplementalMetricSettings;
};

export const DEFAULT_SUPPLEMENTAL_METRIC_SETTINGS: SupplementalMetricSettings = supplementalMetricSettingsWith(false);

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  useSectorWeights: true,
  supplementalMetrics: DEFAULT_SUPPLEMENTAL_METRIC_SETTINGS,
};

export const APP_SETTINGS_STORAGE_KEY = "invest-rate.settings.v1";

export const SECTOR_WEIGHTS_QUERY_PARAM = "sectorWeights";

export function readAnalysisSettings(storageKey: string): AnalysisSettings {
  if (typeof window === "undefined") return DEFAULT_ANALYSIS_SETTINGS;

  try {
    const raw = readBrowserStorageItem(storageKey);
    return normalizeAnalysisSettings(raw ? JSON.parse(raw) : undefined);
  } catch {
    return DEFAULT_ANALYSIS_SETTINGS;
  }
}

export function writeAnalysisSettings(storageKey: string, settings: AnalysisSettings) {
  if (typeof window === "undefined") return;
  writeBrowserStorageItem(storageKey, JSON.stringify(normalizeAnalysisSettings(settings)));
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
    supplementalMetrics: normalizeSupplementalMetricSettings(rawSettings),
  };
}

function normalizeSupplementalMetricSettings(value: Partial<AnalysisSettings> & { showSupplementalMetrics?: unknown }) {
  if (value.showSupplementalMetrics === true) {
    return supplementalMetricSettingsWith(true);
  }

  const rawMetrics = value.supplementalMetrics;
  if (!rawMetrics || typeof rawMetrics !== "object" || Array.isArray(rawMetrics)) {
    return DEFAULT_ANALYSIS_SETTINGS.supplementalMetrics;
  }

  const normalized = {} as SupplementalMetricSettings;
  const metrics = rawMetrics as Partial<Record<SupplementalMetricId, unknown>>;
  for (const metricId of supplementalMetricIds) {
    const metricValue = metrics[metricId];
    normalized[metricId] =
      typeof metricValue === "boolean" ? metricValue : DEFAULT_SUPPLEMENTAL_METRIC_SETTINGS[metricId];
  }
  return normalized;
}

function supplementalMetricSettingsWith(enabled: boolean) {
  return Object.fromEntries(supplementalMetricIds.map((metricId) => [metricId, enabled])) as SupplementalMetricSettings;
}
