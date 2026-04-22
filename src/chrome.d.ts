declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      windowId?: number;
      title?: string;
      url?: string;
      favIconUrl?: string;
      active?: boolean;
      lastAccessed?: number;
    }
    function query(queryInfo: Record<string, unknown>): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function create(createProperties: { url?: string; active?: boolean }): Promise<Tab>;
    function update(tabId: number, updateProperties: { active?: boolean; url?: string }): Promise<Tab>;
    function remove(tabId: number | number[]): Promise<void>;
    function sendMessage(tabId: number, message: unknown): void;
  }

  namespace windows {
    function update(windowId: number, updateInfo: { focused?: boolean }): Promise<void>;
  }

  namespace history {
    interface HistoryItem {
      id: string;
      title?: string;
      url?: string;
      lastVisitTime?: number;
    }
    function search(query: { text: string; maxResults?: number; startTime?: number }): Promise<HistoryItem[]>;
  }

  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      title: string;
      url?: string;
      children?: BookmarkTreeNode[];
    }
    function search(query: string): Promise<BookmarkTreeNode[]>;
  }

  namespace sessions {
    interface Session {
      lastModified?: number;
      tab?: tabs.Tab & { sessionId?: string };
      window?: { sessionId?: string };
    }
    function getRecentlyClosed(filter?: { maxResults?: number }): Promise<Session[]>;
    function restore(sessionId: string): Promise<Session>;
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
    };
  }

  namespace runtime {
    function getURL(path: string): string;
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: { tab?: tabs.Tab; id?: string },
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    };
    function sendMessage(message: unknown, responseCallback?: (response: unknown) => void): void;
  }

  namespace storage {
    const sync: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }
}
