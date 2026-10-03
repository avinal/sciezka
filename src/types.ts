export type SearchMode = "tabs" | "history" | "bookmarks" | "closed" | "duplicates" | "stale";
export type SearchMethod = "fuzzy" | "fulltext" | "prefix";
export type DuplicateMatchMethod = "exact" | "ignoreHash" | "ignoreQuery";
export type StaleMethod = "time" | "count" | "both";
export type StaleUnit = "hours" | "days" | "weeks";

export interface SearchItem {
  id: string;
  title: string;
  url: string;
  type: SearchMode;
  favIconUrl?: string;
  lastAccessed?: number;
  duplicateCount?: number;
}

export interface SearchResult {
  item: SearchItem;
  score: number;
  positions: number[];
}

export interface SearchRequest {
  type: "search";
  query: string;
  mode: SearchMode;
  method: SearchMethod;
}

export interface SearchResponse {
  type: "searchResults";
  results: SearchResult[];
}

export interface ActionRequest {
  type: "action";
  action: "switch" | "open" | "close" | "restore" | "closeDuplicates";
  id: string;
  newTab?: boolean;
}

export interface ToggleMessage {
  type: "toggle";
}

export interface CloseMessage {
  type: "closeSciezka";
}

export interface ResizeMessage {
  type: "resize";
  height: number;
}

export interface Settings {
  defaultMethod: SearchMethod;
  modeOrder: SearchMode[];
  duplicateMatchMethod: DuplicateMatchMethod;
  staleMethod: StaleMethod;
  staleThreshold: number;
  staleThresholdUnit: StaleUnit;
  staleMaxCount: number;
}

export interface GetSettingsRequest {
  type: "getSettings";
}

export interface SaveSettingsRequest {
  type: "saveSettings";
  settings: Partial<Settings>;
}

export interface SettingsResponse {
  type: "settingsResponse";
  settings: Settings;
}

export type Message =
  | SearchRequest
  | SearchResponse
  | ActionRequest
  | ToggleMessage
  | CloseMessage
  | ResizeMessage
  | GetSettingsRequest
  | SaveSettingsRequest
  | SettingsResponse;
