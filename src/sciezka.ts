import { search } from "./search";
import type { SearchItem, SearchMode, SearchMethod, SearchResult, Message, Settings } from "./types";

const ALL_MODES: SearchMode[] = ["tabs", "history", "bookmarks", "closed"];
const MODE_LABELS: Record<SearchMode, string> = {
  tabs: "Tabs",
  history: "History",
  bookmarks: "Bookmarks",
  closed: "Closed",
};
const METHODS: SearchMethod[] = ["fuzzy", "fulltext", "prefix"];
const METHOD_LABELS: Record<SearchMethod, string> = {
  fuzzy: "Fuzzy",
  fulltext: "Full Text",
  prefix: "Prefix",
};

const MESSAGE_NONCE = location.hash.slice(1);

let modes: SearchMode[] = [...ALL_MODES];
let currentMode: SearchMode = "tabs";
let currentMethod: SearchMethod = "fuzzy";
let results: SearchResult[] = [];
let selectedIndex = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let configOpen = false;

const input = document.getElementById("search-input") as HTMLInputElement;
const resultsContainer = document.getElementById("results") as HTMLDivElement;
const modeBar = document.getElementById("mode-bar") as HTMLDivElement;
const methodBadge = document.getElementById("method-badge") as HTMLSpanElement;
const root = document.getElementById("sciezka-root") as HTMLDivElement;
const configPanel = document.getElementById("config-panel") as HTMLDivElement;
const configBtn = document.getElementById("config-btn") as HTMLButtonElement;

function notifyResize(): void {
  const height = Math.min(root.scrollHeight, 520);
  window.parent.postMessage({ type: "resize", _nonce: MESSAGE_NONCE, height }, "*");
}

function sendMessage(msg: Message): Promise<unknown> {
  return new Promise((resolve) => {
    window.parent.postMessage({ ...msg, _nonce: MESSAGE_NONCE }, "*");
    const handler = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data?._nonce || event.data._nonce !== MESSAGE_NONCE) return;
      window.removeEventListener("message", handler);
      resolve(event.data);
    };
    window.addEventListener("message", handler);
  });
}

function persistSettings(): void {
  sendMessage({
    type: "saveSettings",
    settings: { defaultMethod: currentMethod, modeOrder: modes },
  } as Message);
}

function renderModeBar(): void {
  modeBar.replaceChildren();
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const btn = document.createElement("button");
    btn.className = `mode-btn${mode === currentMode ? " active" : ""}`;
    const label = document.createElement("span");
    label.className = "mode-label";
    label.textContent = MODE_LABELS[mode];
    const kbd = document.createElement("kbd");
    kbd.textContent = String(i + 1);
    btn.append(label, kbd);
    btn.addEventListener("click", () => {
      currentMode = mode;
      renderModeBar();
      doSearch();
    });
    modeBar.appendChild(btn);
  }
}

function renderMethodBadge(): void {
  methodBadge.textContent = currentMethod;
}

function toggleConfig(): void {
  configOpen = !configOpen;
  configBtn.classList.toggle("active", configOpen);
  if (configOpen) {
    resultsContainer.style.display = "none";
    configPanel.style.display = "block";
    renderConfigPanel();
  } else {
    configPanel.style.display = "none";
    resultsContainer.style.display = "";
  }
  notifyResize();
}

function renderConfigPanel(): void {
  configPanel.replaceChildren();

  const methodSection = document.createElement("div");
  methodSection.className = "config-section";
  const methodLabel = document.createElement("div");
  methodLabel.className = "config-label";
  methodLabel.textContent = "Search Method";
  methodSection.appendChild(methodLabel);
  const methodRow = document.createElement("div");
  methodRow.className = "config-method-row";
  for (const m of METHODS) {
    const btn = document.createElement("button");
    btn.className = `config-method-btn${m === currentMethod ? " active" : ""}`;
    btn.textContent = METHOD_LABELS[m];
    btn.addEventListener("click", () => {
      currentMethod = m;
      renderMethodBadge();
      renderConfigPanel();
      persistSettings();
      doSearch();
    });
    methodRow.appendChild(btn);
  }
  methodSection.appendChild(methodRow);
  configPanel.appendChild(methodSection);

  const orderSection = document.createElement("div");
  orderSection.className = "config-section";
  const orderLabel = document.createElement("div");
  orderLabel.className = "config-label";
  orderLabel.textContent = "Tab Order ";
  const orderHint = document.createElement("span");
  orderHint.className = "config-hint";
  orderHint.textContent = "drag or use arrows";
  orderLabel.appendChild(orderHint);
  orderSection.appendChild(orderLabel);
  const orderList = document.createElement("div");
  orderList.className = "config-order-list";

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const row = document.createElement("div");
    row.className = "config-order-row";
    row.draggable = true;
    row.dataset.index = String(i);

    const label = document.createElement("span");
    label.className = "config-order-label";
    label.textContent = MODE_LABELS[mode];

    const arrows = document.createElement("span");
    arrows.className = "config-arrows";

    const upBtn = document.createElement("button");
    upBtn.className = "config-arrow-btn";
    upBtn.textContent = "\u25B2";
    upBtn.disabled = i === 0;
    upBtn.addEventListener("click", () => { swapModes(i, i - 1); });

    const downBtn = document.createElement("button");
    downBtn.className = "config-arrow-btn";
    downBtn.textContent = "\u25BC";
    downBtn.disabled = i === modes.length - 1;
    downBtn.addEventListener("click", () => { swapModes(i, i + 1); });

    arrows.appendChild(upBtn);
    arrows.appendChild(downBtn);
    row.appendChild(label);
    row.appendChild(arrows);

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", String(i));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); });
    row.addEventListener("dragover", (e) => { e.preventDefault(); });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer?.getData("text/plain") ?? "", 10);
      if (!isNaN(from) && from !== i) {
        const moved = modes.splice(from, 1)[0];
        modes.splice(i, 0, moved);
        if (currentMode === modes[0]) currentMode = modes[0];
        renderModeBar();
        renderConfigPanel();
        persistSettings();
      }
    });

    orderList.appendChild(row);
  }
  orderSection.appendChild(orderList);
  configPanel.appendChild(orderSection);
  notifyResize();
}

function swapModes(a: number, b: number): void {
  [modes[a], modes[b]] = [modes[b], modes[a]];
  renderModeBar();
  renderConfigPanel();
  persistSettings();
}

function highlightText(text: string, positions: number[], offset: number): DocumentFragment {
  const posSet = new Set(positions.map((p) => p - offset).filter((p) => p >= 0 && p < text.length));
  const frag = document.createDocumentFragment();
  let mark: HTMLElement | null = null;
  for (let i = 0; i < text.length; i++) {
    const matched = posSet.has(i);
    if (matched && !mark) {
      mark = document.createElement("mark");
    }
    if (!matched && mark) {
      frag.appendChild(mark);
      mark = null;
    }
    (mark ?? frag).appendChild(document.createTextNode(text[i]));
  }
  if (mark) frag.appendChild(mark);
  return frag;
}

const TYPE_ICONS: Record<SearchMode, string> = {
  tabs: "📄",
  history: "🕒",
  bookmarks: "⭐",
  closed: "🚪",
};

function renderResults(): void {
  resultsContainer.replaceChildren();
  if (results.length === 0 && input.value) {
    const msg = document.createElement("div");
    msg.className = "no-results";
    msg.textContent = "No results found";
    resultsContainer.appendChild(msg);
    notifyResize();
    return;
  }
  if (results.length === 0 && !input.value) {
    notifyResize();
    return;
  }

  const visible = results.slice(0, 50);
  for (let i = 0; i < visible.length; i++) {
    const { item, positions } = visible[i];
    const row = document.createElement("div");
    row.className = `result-row${i === selectedIndex ? " selected" : ""}`;
    row.dataset.index = String(i);

    const icon = document.createElement("span");
    icon.className = "result-icon";
    if (item.favIconUrl) {
      const img = document.createElement("img");
      img.src = item.favIconUrl;
      img.width = 16;
      img.height = 16;
      img.alt = "";
      icon.appendChild(img);
    } else {
      icon.textContent = TYPE_ICONS[item.type] ?? "";
    }

    const text = document.createElement("span");
    text.className = "result-text";
    const title = document.createElement("span");
    title.className = "result-title";
    title.appendChild(highlightText(item.title, positions, 0));
    const url = document.createElement("span");
    url.className = "result-url";
    url.appendChild(highlightText(item.url, positions, item.title.length + 1));
    text.append(title, url);

    const badge = document.createElement("span");
    badge.className = `result-badge badge-${item.type}`;
    badge.textContent = MODE_LABELS[item.type];

    row.append(icon, text, badge);
    row.addEventListener("click", () => activateResult(i));
    row.addEventListener("mouseenter", () => {
      selectedIndex = i;
      updateSelection();
    });
    resultsContainer.appendChild(row);
  }

  scrollToSelected();
  notifyResize();
}

function updateSelection(): void {
  const rows = resultsContainer.querySelectorAll(".result-row");
  rows.forEach((row, i) => {
    row.classList.toggle("selected", i === selectedIndex);
  });
}

function scrollToSelected(): void {
  const selected = resultsContainer.querySelector(".selected");
  selected?.scrollIntoView({ block: "nearest" });
}

function activateResult(index: number): void {
  const result = results[index];
  if (!result) return;

  const { item } = result;
  let action: string;
  if (item.type === "tabs") {
    action = "switch";
  } else if (item.type === "closed") {
    action = "restore";
  } else {
    action = "open";
  }

  const msg: Message = item.type === "tabs" || item.type === "closed"
    ? { type: "action", action: action as "switch" | "restore", id: item.id }
    : { type: "action", action: "open", id: item.url };

  sendMessage(msg);
  window.parent.postMessage({ type: "closeSaka", _nonce: MESSAGE_NONCE }, "*");
}

async function doSearch(): Promise<void> {
  const query = input.value;
  const response = await sendMessage({
    type: "search",
    query,
    mode: currentMode,
    method: currentMethod,
  } satisfies Message);

  const data = response as { type: string; results: SearchItem[] };
  const items = data.results ?? [];
  results = search(items, query, currentMethod);
  selectedIndex = 0;
  renderResults();
}

input.addEventListener("input", () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 50);
});

configBtn.addEventListener("click", toggleConfig);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (configOpen) {
      toggleConfig();
      return;
    }
    window.parent.postMessage({ type: "closeSaka", _nonce: MESSAGE_NONCE }, "*");
    return;
  }

  if (configOpen) return;

  if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "j")) {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    updateSelection();
    scrollToSelected();
    return;
  }

  if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "k")) {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection();
    scrollToSelected();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (e.ctrlKey && e.shiftKey) {
      const result = results[selectedIndex];
      if (result && result.item.type !== "tabs") {
        sendMessage({ type: "action", action: "open", id: result.item.url, newTab: true });
        window.parent.postMessage({ type: "closeSaka", _nonce: MESSAGE_NONCE }, "*");
      }
    } else {
      activateResult(selectedIndex);
    }
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    const dir = e.shiftKey ? -1 : 1;
    const idx = modes.indexOf(currentMode);
    currentMode = modes[(idx + dir + modes.length) % modes.length];
    renderModeBar();
    doSearch();
    return;
  }

  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    const idx = METHODS.indexOf(currentMethod);
    currentMethod = METHODS[(idx + 1) % METHODS.length];
    renderMethodBadge();
    persistSettings();
    doSearch();
    return;
  }

  if (e.ctrlKey && e.key === "d") {
    e.preventDefault();
    const result = results[selectedIndex];
    if (result && result.item.type === "tabs") {
      sendMessage({ type: "action", action: "close", id: result.item.id });
      results.splice(selectedIndex, 1);
      if (selectedIndex >= results.length) selectedIndex = Math.max(results.length - 1, 0);
      renderResults();
    }
    return;
  }

  if (e.ctrlKey && e.key >= "1" && e.key <= "4") {
    e.preventDefault();
    const modeIdx = parseInt(e.key, 10) - 1;
    if (modeIdx < modes.length) {
      currentMode = modes[modeIdx];
      renderModeBar();
      doSearch();
    }
    return;
  }
});

async function loadSettings(): Promise<void> {
  try {
    const response = await sendMessage({ type: "getSettings" } as Message);
    const data = response as { type: string; settings: Settings };
    if (data?.settings) {
      currentMethod = data.settings.defaultMethod;
      if (data.settings.modeOrder?.length) {
        modes = data.settings.modeOrder;
        currentMode = modes[0];
      }
    }
  } catch {
    // defaults
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  renderModeBar();
  renderMethodBadge();
  input.focus();
  doSearch();
});
