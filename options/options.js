const optMode = document.getElementById("opt-mode");
const optMethod = document.getElementById("opt-method");
const savedMsg = document.getElementById("saved-msg");

const ALL_MODES = ["tabs", "history", "bookmarks", "closed"];

async function load() {
  const data = await chrome.storage.sync.get(["modeOrder", "defaultMethod"]);
  if (data.modeOrder && data.modeOrder.length) {
    optMode.value = data.modeOrder[0];
  }
  if (data.defaultMethod) optMethod.value = data.defaultMethod;
}

function showSaved() {
  savedMsg.classList.add("show");
  setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

async function save() {
  const defaultMode = optMode.value;
  const reordered = [defaultMode, ...ALL_MODES.filter((m) => m !== defaultMode)];
  await chrome.storage.sync.set({
    modeOrder: reordered,
    defaultMethod: optMethod.value,
  });
  showSaved();
}

optMode.addEventListener("change", save);
optMethod.addEventListener("change", save);

load();
