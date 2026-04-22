import type { Message, SearchRequest, ActionRequest, SearchItem } from "./types";

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
    maxResults: 50,
    startTime: 0,
  });
  return sortByRecent(results.map((item) => ({
    id: `history-${item.id}`,
    title: item.title ?? "",
    url: item.url ?? "",
    type: "history" as const,
    lastAccessed: item.lastVisitTime,
  })));
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
  }
}

async function handleAction(request: ActionRequest): Promise<void> {
  const rawId = request.id.replace(/^(tab|history|bookmark|closed)-/, "");

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
  }
);
