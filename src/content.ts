import type { Message } from "./types";

let overlay: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;

function createOverlay(): void {
  overlay = document.createElement("div");
  overlay.id = "sciezka-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0);
    z-index: 2147483647;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    transition: background 0.15s ease;
  `;

  iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sciezka.html");
  iframe.style.cssText = `
    width: 620px;
    height: 60px;
    border: none;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    background: transparent;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.15s ease, transform 0.15s ease, height 0.1s ease;
  `;

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay!.style.background = "rgba(0, 0, 0, 0.4)";
    iframe!.style.opacity = "1";
    iframe!.style.transform = "translateY(0)";
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      removeOverlay();
    }
  });
}

function removeOverlay(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
    iframe = null;
  }
}

function toggle(): void {
  if (overlay) {
    removeOverlay();
  } else {
    createOverlay();
  }
}

chrome.runtime.onMessage.addListener((msg: unknown) => {
  const message = msg as Message;
  if (message.type === "toggle") {
    toggle();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay) {
    removeOverlay();
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== iframe?.contentWindow) return;

  const data = event.data as Message;
  if (data.type === "closeSaka") {
    removeOverlay();
    return;
  }
  if (data.type === "resize") {
    if (iframe) {
      iframe.style.height = `${(data as { height: number }).height}px`;
    }
    return;
  }
  if (data.type === "search" || data.type === "action") {
    chrome.runtime.sendMessage(data, (response) => {
      iframe?.contentWindow?.postMessage(response, "*");
    });
  }
});
