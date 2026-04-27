export type SearchMode = "tabs" | "history" | "bookmarks" | "closed";
export type SearchMethod = "fuzzy" | "fulltext" | "prefix";

export interface SearchItem {
  id: string;
  title: string;
  url: string;
  type: SearchMode;
  favIconUrl?: string;
  lastAccessed?: number;
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
  action: "switch" | "open" | "close" | "restore";
  id: string;
  newTab?: boolean;
}

export interface ToggleMessage {
  type: "toggle";
}

export interface CloseMessage {
  type: "closeSaka";
}

export interface ResizeMessage {
  type: "resize";
  height: number;
}

export interface Settings {
  defaultMethod: SearchMethod;
  modeOrder: SearchMode[];
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
