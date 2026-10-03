const optMode = document.getElementById("opt-mode");
const optMethod = document.getElementById("opt-method");
const optDupMethod = document.getElementById("opt-dup-method");
const optStaleMethod = document.getElementById("opt-stale-method");
const optStaleThreshold = document.getElementById("opt-stale-threshold");
const optStaleUnit = document.getElementById("opt-stale-unit");
const optStaleMax = document.getElementById("opt-stale-max");
const savedMsg = document.getElementById("saved-msg");

const ALL_MODES = ["tabs", "history", "bookmarks", "closed", "duplicates", "stale"];

async function load() {
  const data = await chrome.storage.sync.get([
    "modeOrder", "defaultMethod", "duplicateMatchMethod",
    "staleMethod", "staleThreshold", "staleThresholdUnit", "staleMaxCount",
  ]);
  if (data.modeOrder && data.modeOrder.length) {
    optMode.value = data.modeOrder[0];
  }
  if (data.defaultMethod) optMethod.value = data.defaultMethod;
  if (data.duplicateMatchMethod) optDupMethod.value = data.duplicateMatchMethod;
  if (data.staleMethod) optStaleMethod.value = data.staleMethod;
  if (data.staleThreshold) optStaleThreshold.value = data.staleThreshold;
  if (data.staleThresholdUnit) optStaleUnit.value = data.staleThresholdUnit;
  if (data.staleMaxCount) optStaleMax.value = data.staleMaxCount;
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
    duplicateMatchMethod: optDupMethod.value,
    staleMethod: optStaleMethod.value,
    staleThreshold: Math.max(1, parseInt(optStaleThreshold.value, 10) || 1),
    staleThresholdUnit: optStaleUnit.value,
    staleMaxCount: Math.max(1, parseInt(optStaleMax.value, 10) || 50),
  });
  showSaved();
}

optMode.addEventListener("change", save);
optMethod.addEventListener("change", save);
optDupMethod.addEventListener("change", save);
optStaleMethod.addEventListener("change", save);
optStaleThreshold.addEventListener("change", save);
optStaleUnit.addEventListener("change", save);
optStaleMax.addEventListener("change", save);

load();
