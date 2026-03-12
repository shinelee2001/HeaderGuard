import fs from "node:fs/promises";
import path from "node:path";
import { BASELINE_SITES } from "./baseline-sites";
import { normalizeHeaders } from "../src/analyzer/normalize";
import { analyzeHeaders } from "../src/analyzer";
import { computeRawScore, toGrade } from "../src/analyzer/scoring";
import { buildCalibrationProfile } from "../src/analyzer/calibration-profile-builder";

type HeaderEntry = { name: string; value: string };

type BaselineSample = {
  url: string;
  finalUrl: string;
  status: number;
  rawScore: number;
  rawGrade: string;
  collectedAt: string;
  headers: Record<string, string[]>;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 750;
const MIN_REQUIRED_SAMPLES = Math.max(10, Math.ceil(BASELINE_SITES.length * 0.7));

const REQUEST_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("ecanceled")
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMainDocumentHeadersWithRetry(url: string): Promise<{
  finalUrl: string;
  status: number;
  headerEntries: HeaderEntry[];
}> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);

      if (!response.ok && isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        console.warn(
          `[RETRY] ${url} responded with ${response.status}; retrying in ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }

      const headerEntries: HeaderEntry[] = [];
      for (const [name, value] of response.headers.entries()) {
        headerEntries.push({ name, value });
      }

      return {
        finalUrl: response.url,
        status: response.status,
        headerEntries,
      };
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        console.warn(`[RETRY] ${url} failed (${String(error)}); retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function collectOne(url: string): Promise<BaselineSample> {
  const { finalUrl, status, headerEntries } =
    await fetchMainDocumentHeadersWithRetry(url);

  const rawHeaders = normalizeHeaders(headerEntries);
  const final = new URL(finalUrl);

  const analysis = analyzeHeaders({
    version: "0.1.0",
    analyzedAt: new Date().toISOString(),
    tabId: -1,
    url: finalUrl,
    origin: final.origin,
    scheme:
      final.protocol === "https:"
        ? "https"
        : final.protocol === "http:"
          ? "http"
          : "other",
    rawHeaders,
    notes: ["Baseline calibration collection script."],
  });

  const rawScore = computeRawScore(analysis.findings);
  const rawGrade = toGrade(rawScore);

  return {
    url,
    finalUrl,
    status,
    rawScore,
    rawGrade,
    collectedAt: new Date().toISOString(),
    headers: rawHeaders,
  };
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main(): Promise<void> {
  const samples: BaselineSample[] = [];
  const failures: Array<{ url: string; error: string }> = [];

  console.log(`[START] Collecting baseline from ${BASELINE_SITES.length} sites...`);

  for (const url of BASELINE_SITES) {
    try {
      const sample = await collectOne(url);
      samples.push(sample);

      console.log(
        `[OK] ${url} -> ${sample.finalUrl} | status=${sample.status} | raw=${sample.rawScore} | grade=${sample.rawGrade}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ url, error: message });
      console.error(`[FAIL] ${url} | ${message}`);
    }
  }

  if (samples.length < MIN_REQUIRED_SAMPLES) {
    throw new Error(
      `Only ${samples.length} baseline samples collected; need at least ${MIN_REQUIRED_SAMPLES}.`,
    );
  }

  const sortedScores = samples.map((sample) => sample.rawScore).sort((a, b) => a - b);

  const profile = buildCalibrationProfile(sortedScores);

  const outDir = path.resolve("generated");
  await fs.mkdir(outDir, { recursive: true });

  await writeJsonFile(path.join(outDir, "baseline-samples.json"), samples);
  await writeJsonFile(path.join(outDir, "baseline-profile.json"), profile);
  await writeJsonFile(path.join(outDir, "baseline-failures.json"), failures);

  console.log("");
  console.log(`[DONE] Successful samples: ${samples.length}`);
  console.log(`[DONE] Failures: ${failures.length}`);
  console.log(`[DONE] Output dir: ${outDir}`);
  console.log("[DONE] Profile summary:");
  console.log(
    JSON.stringify(
      {
        profile: profile.profile,
        method: profile.method,
        stats: profile.stats,
        target: profile.target,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[FATAL]", error);
  process.exit(1);
});