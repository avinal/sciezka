import { search } from "./search";
import type { SearchItem, SearchMode, SearchMethod, SearchResult, Message, Settings, DuplicateMatchMethod, StaleMethod, StaleUnit } from "./types";

const ALL_MODES: SearchMode[] = ["tabs", "history", "bookmarks", "closed", "duplicates", "stale"];
const MODE_LABELS: Record<SearchMode, string> = {
  tabs: "Tabs",
  history: "History",
  bookmarks: "Bookmarks",
  closed: "Closed",
  duplicates: "Duplicates",
  stale: "Stale",
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
let currentDupMethod: DuplicateMatchMethod = "exact";
let currentStaleMethod: StaleMethod = "time";
let currentStaleThreshold = 4;
let currentStaleThresholdUnit: StaleUnit = "weeks";
let currentStaleMaxCount = 100;
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
  return new Promise((resolve, reject) => {
    window.parent.postMessage({ ...msg, _nonce: MESSAGE_NONCE }, "*");
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Message timeout"));
    }, 5000);
    const handler = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data?._nonce || event.data._nonce !== MESSAGE_NONCE) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data);
    };
    window.addEventListener("message", handler);
  });
}

function persistSettings(): void {
  sendMessage({
    type: "saveSettings",
    settings: {
      defaultMethod: currentMethod,
      modeOrder: modes,
      duplicateMatchMethod: currentDupMethod,
      staleMethod: currentStaleMethod,
      staleThreshold: currentStaleThreshold,
      staleThresholdUnit: currentStaleThresholdUnit,
      staleMaxCount: currentStaleMaxCount,
    },
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
  const spacer = document.createElement("span");
  spacer.style.flex = "1";
  modeBar.appendChild(spacer);
  const count = document.createElement("span");
  count.id = "result-count";
  count.textContent = String(results.length);
  modeBar.appendChild(count);
}

function updateResultCount(): void {
  const el = document.getElementById("result-count");
  if (el) el.textContent = String(results.length);
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

  const DUP_METHODS: DuplicateMatchMethod[] = ["exact", "ignoreHash", "ignoreQuery"];
  const DUP_METHOD_LABELS: Record<DuplicateMatchMethod, string> = {
    exact: "Exact URL",
    ignoreHash: "Ignore #hash",
    ignoreQuery: "Ignore ?query",
  };
  const dupSection = document.createElement("div");
  dupSection.className = "config-section";
  const dupLabel = document.createElement("div");
  dupLabel.className = "config-label";
  dupLabel.textContent = "Duplicate Matching";
  dupSection.appendChild(dupLabel);
  const dupRow = document.createElement("div");
  dupRow.className = "config-method-row";
  for (const dm of DUP_METHODS) {
    const btn = document.createElement("button");
    btn.className = `config-method-btn${dm === currentDupMethod ? " active" : ""}`;
    btn.textContent = DUP_METHOD_LABELS[dm];
    btn.addEventListener("click", () => {
      currentDupMethod = dm;
      renderConfigPanel();
      persistSettings();
      if (currentMode === "duplicates") doSearch();
    });
    dupRow.appendChild(btn);
  }
  dupSection.appendChild(dupRow);
  configPanel.appendChild(dupSection);

  const STALE_METHODS: StaleMethod[] = ["time", "count", "both"];
  const STALE_METHOD_LABELS: Record<StaleMethod, string> = {
    time: "Time",
    count: "Count",
    both: "Time + Cap",
  };
  const staleSection = document.createElement("div");
  staleSection.className = "config-section";
  const staleLabel = document.createElement("div");
  staleLabel.className = "config-label";
  staleLabel.textContent = "Stale Tabs";
  staleSection.appendChild(staleLabel);
  const staleRow = document.createElement("div");
  staleRow.className = "config-method-row";
  for (const sm of STALE_METHODS) {
    const btn = document.createElement("button");
    btn.className = `config-method-btn${sm === currentStaleMethod ? " active" : ""}`;
    btn.textContent = STALE_METHOD_LABELS[sm];
    btn.addEventListener("click", () => {
      currentStaleMethod = sm;
      renderConfigPanel();
      persistSettings();
      if (currentMode === "stale") doSearch();
    });
    staleRow.appendChild(btn);
  }
  staleSection.appendChild(staleRow);

  const staleInputs = document.createElement("div");
  staleInputs.className = "config-inputs-row";
  if (currentStaleMethod === "time" || currentStaleMethod === "both") {
    const threshLabel = document.createElement("label");
    threshLabel.className = "config-input-label";
    threshLabel.textContent = "Older than";
    const threshInput = document.createElement("input");
    threshInput.type = "number";
    threshInput.className = "config-number-input";
    threshInput.min = "1";
    threshInput.value = String(currentStaleThreshold);
    threshInput.addEventListener("change", () => {
      currentStaleThreshold = Math.max(1, parseInt(threshInput.value, 10) || 1);
      persistSettings();
      if (currentMode === "stale") doSearch();
    });
    const unitSelect = document.createElement("select");
    unitSelect.className = "config-unit-select";
    const UNITS: StaleUnit[] = ["hours", "days", "weeks"];
    for (const u of UNITS) {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      opt.selected = u === currentStaleThresholdUnit;
      unitSelect.appendChild(opt);
    }
    unitSelect.addEventListener("change", () => {
      currentStaleThresholdUnit = unitSelect.value as StaleUnit;
      persistSettings();
      if (currentMode === "stale") doSearch();
    });
    threshLabel.append(threshInput, unitSelect);
    staleInputs.appendChild(threshLabel);
  }
  if (currentStaleMethod === "count" || currentStaleMethod === "both") {
    const countLabel = document.createElement("label");
    countLabel.className = "config-input-label";
    countLabel.textContent = "Max";
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.className = "config-number-input";
    countInput.min = "1";
    countInput.value = String(currentStaleMaxCount);
    countInput.addEventListener("change", () => {
      currentStaleMaxCount = Math.max(1, parseInt(countInput.value, 10) || 50);
      persistSettings();
      if (currentMode === "stale") doSearch();
    });
    countLabel.appendChild(countInput);
    staleInputs.appendChild(countLabel);
  }
  staleSection.appendChild(staleInputs);
  configPanel.appendChild(staleSection);

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
  duplicates: "🔄",
  stale: "💤",
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

    if (item.duplicateCount != null && item.duplicateCount > 1) {
      const countBadge = document.createElement("span");
      countBadge.className = "result-badge badge-duplicate-count";
      countBadge.textContent = `×${item.duplicateCount}`;
      row.append(icon, text, countBadge, badge);
    } else {
      row.append(icon, text, badge);
    }
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
  if (item.type === "tabs" || item.type === "duplicates" || item.type === "stale") {
    action = "switch";
  } else if (item.type === "closed") {
    action = "restore";
  } else {
    action = "open";
  }

  const msg: Message = item.type === "tabs" || item.type === "closed" || item.type === "duplicates" || item.type === "stale"
    ? { type: "action", action: action as "switch" | "restore", id: item.id }
    : { type: "action", action: "open", id: item.url };

  sendMessage(msg);
  window.parent.postMessage({ type: "closeSciezka", _nonce: MESSAGE_NONCE }, "*");
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
  updateResultCount();
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
    window.parent.postMessage({ type: "closeSciezka", _nonce: MESSAGE_NONCE }, "*");
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
      if (result && result.item.type !== "tabs" && result.item.type !== "duplicates" && result.item.type !== "stale") {
        sendMessage({ type: "action", action: "open", id: result.item.url, newTab: true });
        window.parent.postMessage({ type: "closeSciezka", _nonce: MESSAGE_NONCE }, "*");
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
    if (result && result.item.type === "duplicates") {
      sendMessage({ type: "action", action: "closeDuplicates", id: result.item.id }).then(() => {
        results.splice(selectedIndex, 1);
        if (selectedIndex >= results.length) selectedIndex = Math.max(results.length - 1, 0);
        doSearch();
      });
    } else if (result && (result.item.type === "tabs" || result.item.type === "stale")) {
      sendMessage({ type: "action", action: "close", id: result.item.id });
      results.splice(selectedIndex, 1);
      if (selectedIndex >= results.length) selectedIndex = Math.max(results.length - 1, 0);
      renderResults();
      updateResultCount();
    }
    return;
  }

  if (e.ctrlKey && e.key >= "1" && e.key <= String(Math.min(modes.length, 9))) {
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
      if (data.settings.duplicateMatchMethod) {
        currentDupMethod = data.settings.duplicateMatchMethod;
      }
      if (data.settings.staleMethod) {
        currentStaleMethod = data.settings.staleMethod;
      }
      if (data.settings.staleThreshold) {
        currentStaleThreshold = data.settings.staleThreshold;
      }
      if (data.settings.staleThresholdUnit) {
        currentStaleThresholdUnit = data.settings.staleThresholdUnit;
      }
      if (data.settings.staleMaxCount) {
        currentStaleMaxCount = data.settings.staleMaxCount;
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
