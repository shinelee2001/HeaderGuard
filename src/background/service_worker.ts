import { analyzeHeaders } from "../analyzer";
import type { AnalysisResult, HeaderMap } from "../analyzer/types";

const SESSION_KEY_PREFIX = "analysis:";
const inMemoryCache = new Map<number, AnalysisResult>();

type PopupRequest =
  | { type: "GET_LATEST_ANALYSIS"; tabId?: number }
  | { type: "PING" };

type PopupResponse =
  | { ok: true; result: AnalysisResult | null }
  | { ok: true; pong: true }
  | { ok: false; error: string };

function isSupportedScheme(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function getScheme(url: string): "http" | "https" | "other" {
  if (url.startsWith("https://")) return "https";
  if (url.startsWith("http://")) return "http";
  return "other";
}

function getStorageKey(tabId: number): string {
  return `${SESSION_KEY_PREFIX}${tabId}`;
}

function normalizeHeaders(
  responseHeaders: chrome.webRequest.HttpHeader[] | undefined
): HeaderMap {
  const normalized: HeaderMap = {};

  for (const header of responseHeaders ?? []) {
    if (!header?.name) continue;

    const name = header.name.trim().toLowerCase();
    const value = (header.value ?? "").trim();

    if (!normalized[name]) {
      normalized[name] = [];
    }

    normalized[name].push(value);
  }

  return normalized;
}

async function persistAnalysis(result: AnalysisResult): Promise<void> {
  inMemoryCache.set(result.tabId, result);

  await chrome.storage.session.set({
    [getStorageKey(result.tabId)]: result,
  });
}

async function removeAnalysis(tabId: number): Promise<void> {
  inMemoryCache.delete(tabId);
  await chrome.storage.session.remove(getStorageKey(tabId));
}

async function getLatestAnalysis(tabId: number): Promise<AnalysisResult | null> {
  const cached = inMemoryCache.get(tabId);
  if (cached) return cached;

  const stored = await chrome.storage.session.get(getStorageKey(tabId));
  return (stored[getStorageKey(tabId)] as AnalysisResult | undefined) ?? null;
}

async function captureAndAnalyze(
  details: chrome.webRequest.WebResponseHeadersDetails
): Promise<void> {
  try {
    if (details.tabId < 0) return;
    if (details.type !== "main_frame") return;
    if (!details.url || !isSupportedScheme(details.url)) return;

    const rawHeaders = normalizeHeaders(details.responseHeaders);

    const url = new URL(details.url);
    const origin = url.origin;
    const scheme = getScheme(details.url);

    const result = analyzeHeaders({
      version: "0.1.0",
      tabId: details.tabId,
      url: details.url,
      origin,
      scheme,
      rawHeaders,
      analyzedAt: new Date().toISOString(),
      notes: [
        "This tool analyzes the main document response only.",
        "All analysis is performed locally in the browser.",
      ],
    });

    await persistAnalysis(result);
  } catch (error) {
    console.error("[HeaderGuard] captureAndAnalyze failed:", error);
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    void captureAndAnalyze(details);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener(
  (
    message: PopupRequest,
    _sender,
    sendResponse: (response: PopupResponse) => void
  ) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true, pong: true });
      return false;
    }

    if (message?.type === "GET_LATEST_ANALYSIS") {
      void (async () => {
        try {
          let tabId = message.tabId;

          if (typeof tabId !== "number") {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });

            if (typeof activeTab?.id !== "number") {
              sendResponse({ ok: false, error: "Active tab not found." });
              return;
            }

            tabId = activeTab.id;
          }

          const result = await getLatestAnalysis(tabId);
          sendResponse({ ok: true, result });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          sendResponse({ ok: false, error: errorMessage });
        }
      })();

      return true;
    }

    sendResponse({ ok: false, error: "Unsupported message type." });
    return false;
  }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeAnalysis(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void removeAnalysis(removedTabId);
  inMemoryCache.delete(addedTabId);
});

chrome.runtime.onInstalled.addListener(() => {
  console.info(
    "[HeaderGuard] Installed. This extension analyzes response headers locally."
  );
});