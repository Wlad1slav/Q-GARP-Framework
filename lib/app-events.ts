import type { AnalysisSettings } from "./analysis-settings";
import type { Language } from "./i18n";

export const APP_ANALYSIS_REQUEST_EVENT = "invest-rate:analysis-request";
export const APP_ANALYSIS_SETTINGS_CHANGE_EVENT = "invest-rate:analysis-settings-change";
export const APP_ANALYSIS_STATUS_EVENT = "invest-rate:analysis-status";
export const APP_LANGUAGE_CHANGE_EVENT = "invest-rate:language-change";

export type AppAnalysisRequestDetail = {
  language: Language;
  settings: AnalysisSettings;
  ticker: string;
};

export type AppAnalysisSettingsChangeDetail = {
  settings: AnalysisSettings;
};

export type AppAnalysisStatusDetail = {
  lastTicker: string;
  loading: boolean;
};

export type AppLanguageChangeDetail = {
  language: Language;
};
