export type SearchMode = "tabs" | "history" | "bookmarks" | "closed" | "all";
export type SearchMethod = "fuzzy" | "fulltext" | "prefix";

export interface SearchItem {
  id: string;
  title: string;
  url: string;
  type: SearchMode;
  favIconUrl?: string;
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

export type Message =
  | SearchRequest
  | SearchResponse
  | ActionRequest
  | ToggleMessage
  | CloseMessage
  | ResizeMessage;
