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
  modeBar.innerHTML = "";
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const btn = document.createElement("button");
    btn.className = `mode-btn${mode === currentMode ? " active" : ""}`;
    btn.innerHTML = `<span class="mode-label">${MODE_LABELS[mode]}</span><kbd>${i + 1}</kbd>`;
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
  configPanel.innerHTML = "";

  const methodSection = document.createElement("div");
  methodSection.className = "config-section";
  methodSection.innerHTML = `<div class="config-label">Search Method</div>`;
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
  orderSection.innerHTML = `<div class="config-label">Tab Order <span class="config-hint">drag or use arrows</span></div>`;
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

function highlightText(text: string, positions: number[], offset: number): string {
  const posSet = new Set(positions.map((p) => p - offset).filter((p) => p >= 0 && p < text.length));
  let result = "";
  let inMark = false;
  for (let i = 0; i < text.length; i++) {
    const matched = posSet.has(i);
    if (matched && !inMark) { result += "<mark>"; inMark = true; }
    if (!matched && inMark) { result += "</mark>"; inMark = false; }
    result += escapeHtml(text[i]);
  }
  if (inMark) result += "</mark>";
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function typeIcon(type: SearchMode): string {
  switch (type) {
    case "tabs": return "&#x1F4C4;";
    case "history": return "&#x1F552;";
    case "bookmarks": return "&#x2B50;";
    case "closed": return "&#x1F6AA;";
    default: return "";
  }
}

function renderResults(): void {
  resultsContainer.innerHTML = "";
  if (results.length === 0 && input.value) {
    resultsContainer.innerHTML = `<div class="no-results">No results found</div>`;
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

    const titleHtml = highlightText(item.title, positions, 0);
    const urlHtml = highlightText(item.url, positions, item.title.length + 1);

    row.innerHTML = `
      <span class="result-icon">${item.favIconUrl ? `<img src="${escapeHtml(item.favIconUrl)}" width="16" height="16" alt="">` : typeIcon(item.type)}</span>
      <span class="result-text">
        <span class="result-title">${titleHtml}</span>
        <span class="result-url">${urlHtml}</span>
      </span>
      <span class="result-badge badge-${item.type}">${MODE_LABELS[item.type]}</span>
    `;

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
