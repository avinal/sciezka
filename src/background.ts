import type { Message, SearchRequest, ActionRequest, SearchItem, Settings, DuplicateMatchMethod, StaleMethod, StaleUnit } from "./types";

const DEFAULT_SETTINGS: Settings = {
  defaultMethod: "fuzzy",
  modeOrder: ["tabs", "history", "bookmarks", "closed", "duplicates", "stale"],
  duplicateMatchMethod: "exact",
  staleMethod: "time" as StaleMethod,
  staleThreshold: 4,
  staleThresholdUnit: "weeks" as StaleUnit,
  staleMaxCount: 100,
};

async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.sync.get(["defaultMethod", "modeOrder", "duplicateMatchMethod", "staleMethod", "staleThreshold", "staleThresholdUnit", "staleMaxCount"]);
  const settings = { ...DEFAULT_SETTINGS, ...data } as Settings;
  for (const mode of DEFAULT_SETTINGS.modeOrder) {
    if (!settings.modeOrder.includes(mode)) {
      settings.modeOrder.push(mode);
    }
  }
  return settings;
}

async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.sync.set(updated);
  return updated;
}

function sortByRecent(items: SearchItem[]): SearchItem[] {
  return items.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
}

async function getOpenTabs(): Promise<SearchItem[]> {
  const tabs = await chrome.tabs.query({});
  return sortByRecent(tabs.map((tab) => ({
    id: `tab-${tab.id}`,
    title: tab.title ?? "",
    url: tab.url ?? "",
    type: "tabs" as const,
    favIconUrl: tab.favIconUrl,
    lastAccessed: tab.lastAccessed,
  })));
}

async function getHistory(query: string): Promise<SearchItem[]> {
  const results = await chrome.history.search({
    text: query,
    maxResults: 100,
    startTime: 0,
  });
  const seen = new Set<string>();
  const items: SearchItem[] = [];
  for (const item of results) {
    const url = item.url ?? "";
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({
      id: `history-${item.id}`,
      title: item.title ?? "",
      url,
      type: "history" as const,
      lastAccessed: item.lastVisitTime,
    });
  }
  return sortByRecent(items);
}

async function getBookmarks(query: string): Promise<SearchItem[]> {
  const results = await chrome.bookmarks.search(query || " ");
  return results
    .filter((b) => b.url)
    .map((item) => ({
      id: `bookmark-${item.id}`,
      title: item.title ?? "",
      url: item.url!,
      type: "bookmarks" as const,
    }));
}

async function getRecentlyClosed(): Promise<SearchItem[]> {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  return sortByRecent(sessions
    .filter((s) => s.tab)
    .map((session) => ({
      id: `closed-${session.tab!.sessionId}`,
      title: session.tab!.title ?? "",
      url: session.tab!.url ?? "",
      type: "closed" as const,
      favIconUrl: session.tab!.favIconUrl,
      lastAccessed: session.lastModified ? session.lastModified * 1000 : undefined,
    })));
}

function normalizeUrl(url: string, method: DuplicateMatchMethod): string {
  if (method === "exact") return url;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (method === "ignoreQuery") {
      parsed.search = "";
    }
    return parsed.href;
  } catch {
    return url;
  }
}

async function getDuplicateTabs(): Promise<SearchItem[]> {
  const settings = await getSettings();
  const method = settings.duplicateMatchMethod;
  const tabs = await chrome.tabs.query({});

  const groups = new Map<string, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    const key = normalizeUrl(tab.url ?? "", method);
    const group = groups.get(key);
    if (group) {
      group.push(tab);
    } else {
      groups.set(key, [tab]);
    }
  }

  const items: SearchItem[] = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
    const tab = group[0];
    items.push({
      id: `tab-${tab.id}`,
      title: tab.title ?? "",
      url: tab.url ?? "",
      type: "duplicates" as const,
      favIconUrl: tab.favIconUrl,
      lastAccessed: tab.lastAccessed,
      duplicateCount: group.length,
    });
  }

  return sortByRecent(items);
}

const UNIT_TO_HOURS: Record<StaleUnit, number> = { hours: 1, days: 24, weeks: 168 };

async function getStaleTabs(): Promise<SearchItem[]> {
  const settings = await getSettings();
  const { staleMethod, staleThreshold, staleThresholdUnit, staleMaxCount } = settings;
  const tabs = await chrome.tabs.query({});
  const thresholdHours = staleThreshold * UNIT_TO_HOURS[staleThresholdUnit];
  const cutoff = Date.now() - thresholdHours * 3600000;

  let filtered: chrome.tabs.Tab[];
  if (staleMethod === "count") {
    filtered = [...tabs].sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0)).slice(0, staleMaxCount);
  } else {
    filtered = tabs.filter((tab) => (tab.lastAccessed ?? 0) < cutoff);
    filtered.sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));
    if (staleMethod === "both") {
      filtered = filtered.slice(0, staleMaxCount);
    }
  }

  return filtered.map((tab) => ({
    id: `tab-${tab.id}`,
    title: tab.title ?? "",
    url: tab.url ?? "",
    type: "stale" as const,
    favIconUrl: tab.favIconUrl,
    lastAccessed: tab.lastAccessed,
  }));
}

async function handleSearch(request: SearchRequest): Promise<SearchItem[]> {
  const { query, mode } = request;
  switch (mode) {
    case "tabs":
      return getOpenTabs();
    case "history":
      return getHistory(query);
    case "bookmarks":
      return getBookmarks(query);
    case "closed":
      return getRecentlyClosed();
    case "duplicates":
      return getDuplicateTabs();
    case "stale":
      return getStaleTabs();
  }
}

async function handleAction(request: ActionRequest): Promise<void> {
  const rawId = request.id.replace(/^(tab|history|bookmark|closed)-/, "");

  try {
    switch (request.action) {
      case "switch": {
        const tabId = parseInt(rawId, 10);
        await chrome.tabs.update(tabId, { active: true });
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId != null) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        break;
      }
      case "open": {
        if (request.newTab) {
          await chrome.tabs.create({ url: request.id });
        } else {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (activeTab?.id != null) {
            await chrome.tabs.update(activeTab.id, { url: request.id });
          }
        }
        break;
      }
      case "close": {
        const tabId = parseInt(rawId, 10);
        await chrome.tabs.remove(tabId);
        break;
      }
      case "restore": {
        await chrome.sessions.restore(rawId);
        break;
      }
      case "closeDuplicates": {
        const keepId = parseInt(rawId, 10);
        const keepTab = await chrome.tabs.get(keepId);
        const settings = await getSettings();
        const keepKey = normalizeUrl(keepTab.url ?? "", settings.duplicateMatchMethod);
        const allTabs = await chrome.tabs.query({});
        const toClose: number[] = [];
        for (const tab of allTabs) {
          if (tab.id == null || tab.id === keepId) continue;
          if (normalizeUrl(tab.url ?? "", settings.duplicateMatchMethod) === keepKey) {
            toClose.push(tab.id);
          }
        }
        if (toClose.length) await chrome.tabs.remove(toClose);
        break;
      }
    }
  } catch (err) {
    console.error(`[sciezka] action "${request.action}" failed:`, err);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-sciezka") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "toggle" } satisfies Message);
    }
  }
});

chrome.runtime.onMessage.addListener(
  (msg: unknown, _sender, sendResponse) => {
    const message = msg as Message;
    if (message.type === "search") {
      handleSearch(message).then((items) => {
        sendResponse({ type: "searchResults", results: items });
      });
      return true;
    }
    if (message.type === "action") {
      handleAction(message).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === "getSettings") {
      getSettings().then((settings) => {
        sendResponse({ type: "settingsResponse", settings });
      });
      return true;
    }
    if (message.type === "saveSettings") {
      saveSettings(message.settings).then((settings) => {
        sendResponse({ type: "settingsResponse", settings });
      });
      return true;
    }
  }
);
