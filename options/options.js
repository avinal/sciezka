const optMode = document.getElementById("opt-mode");
const optMethod = document.getElementById("opt-method");
const savedMsg = document.getElementById("saved-msg");

async function load() {
  const data = await chrome.storage.sync.get(["defaultMode", "defaultMethod"]);
  if (data.defaultMode) optMode.value = data.defaultMode;
  if (data.defaultMethod) optMethod.value = data.defaultMethod;
}

function showSaved() {
  savedMsg.classList.add("show");
  setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

async function save() {
  await chrome.storage.sync.set({
    defaultMode: optMode.value,
    defaultMethod: optMethod.value,
  });
  showSaved();
}

optMode.addEventListener("change", save);
optMethod.addEventListener("change", save);

load();
