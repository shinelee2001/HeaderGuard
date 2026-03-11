import type { AnalysisResult, Finding, Severity } from "../analyzer/types";

type PopupResponse =
  | { ok: true; result: AnalysisResult | null }
  | { ok: false; error: string };

const loadingState = mustGetById("loading-state");
const errorState = mustGetById("error-state");
const errorMessage = mustGetById("error-message");
const emptyState = mustGetById("empty-state");
const appContent = mustGetById("app-content");

const siteOriginEl = mustGetById("site-origin");
const siteUrlEl = mustGetById("site-url");
const scoreValueEl = mustGetById("score-value");
const gradeBadgeEl = mustGetById("grade-badge");
const schemeChipEl = mustGetById("scheme-chip");
const updatedAtEl = mustGetById("updated-at");
const summaryTextEl = mustGetById("summary-text");
const topRisksListEl = mustGetById("top-risks-list");
const findingCountEl = mustGetById("finding-count");
const findingsListEl = mustGetById("findings-list");
const rawHeadersOutputEl = mustGetById("raw-headers-output");

void init();

async function init(): Promise<void> {
  showState("loading");

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "GET_LATEST_ANALYSIS",
    })) as PopupResponse | undefined;

    if (!response) {
      showError("No response was received from the background service worker.");
      return;
    }

    if (!response.ok) {
      showError(response.error);
      return;
    }

    if (!response.result) {
      showState("empty");
      return;
    }

    renderAnalysis(response.result);
    showState("content");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown popup initialization error.";
    showError(message);
  }
}

function renderAnalysis(result: AnalysisResult): void {
  siteOriginEl.textContent = result.origin;
  siteUrlEl.textContent = result.url;

  scoreValueEl.textContent = String(result.score);
  applyGradeBadge(result.grade);

  schemeChipEl.textContent = result.scheme.toUpperCase();
  schemeChipEl.className = `chip ${result.scheme === "https" ? "chip-good" : result.scheme === "http" ? "chip-warn" : "chip-neutral"}`;

  updatedAtEl.textContent = formatAnalyzedAt(result.analyzedAt);
  summaryTextEl.textContent = result.summary;

  renderTopRisks(result.topRisks);
  renderFindings(result.findings);
  renderRawHeaders(result.rawHeaders);
}

function renderTopRisks(topRisks: string[]): void {
  topRisksListEl.replaceChildren();

  if (topRisks.length === 0) {
    const li = document.createElement("li");
    li.className = "risk-item risk-item-empty";
    li.textContent = "No major risk items were highlighted for this page.";
    topRisksListEl.append(li);
    return;
  }

  for (const risk of topRisks) {
    const li = document.createElement("li");
    li.className = "risk-item";
    li.textContent = risk;
    topRisksListEl.append(li);
  }
}

function renderFindings(findings: Finding[]): void {
  findingsListEl.replaceChildren();
  findingCountEl.textContent = `${findings.length} findings`;

  for (const finding of findings) {
    findingsListEl.append(createFindingCard(finding));
  }
}

function createFindingCard(finding: Finding): HTMLElement {
  const article = document.createElement("article");
  article.className = "finding-card";

  const topRow = document.createElement("div");
  topRow.className = "finding-top-row";

  const titleWrap = document.createElement("div");
  titleWrap.className = "finding-title-wrap";

  const statusDot = document.createElement("span");
  statusDot.className = `status-dot ${getSeverityClass(finding.severity)}`;
  statusDot.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.className = "finding-title";
  title.textContent = finding.title;

  titleWrap.append(statusDot, title);

  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge ${getStatusBadgeClass(finding.status)}`;
  statusBadge.textContent = formatStatusLabel(finding.status);

  topRow.append(titleWrap, statusBadge);

  const observed = document.createElement("div");
  observed.className = "finding-observed";

  const observedLabel = document.createElement("span");
  observedLabel.className = "finding-observed-label";
  observedLabel.textContent = "Observed";

  const observedValue = document.createElement("code");
  observedValue.className = "finding-observed-value";
  observedValue.textContent = formatObservedValues(finding.observedValues);

  observed.append(observedLabel, observedValue);

  const shortExplanation = document.createElement("p");
  shortExplanation.className = "finding-short";
  shortExplanation.textContent = finding.shortExplanation;

  const scoring = document.createElement("p");
  scoring.className = "finding-score";
  scoring.textContent = `Score: ${finding.scoreEarned}/${finding.scorePossible}`;

  const details = document.createElement("details");
  details.className = "finding-details";

  const summary = document.createElement("summary");
  summary.textContent = "Show details";

  const detailsBody = document.createElement("div");
  detailsBody.className = "finding-details-body";

  const riskBlock = createDetailBlock(
    "Why it matters",
    finding.riskInterpretation
  );

  const remediationBlock = createDetailBlock(
    "Suggested improvement",
    finding.remediation
  );

  detailsBody.append(riskBlock, remediationBlock);

  if (finding.deductionReasons.length > 0) {
    const reasonsBlock = document.createElement("section");
    reasonsBlock.className = "detail-block";

    const reasonsTitle = document.createElement("h4");
    reasonsTitle.textContent = "Reasons";

    const reasonsList = document.createElement("ul");
    reasonsList.className = "detail-list";

    for (const reason of finding.deductionReasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      reasonsList.append(item);
    }

    reasonsBlock.append(reasonsTitle, reasonsList);
    detailsBody.append(reasonsBlock);
  }

  details.append(summary, detailsBody);

  article.append(topRow, observed, shortExplanation, scoring, details);
  return article;
}

function createDetailBlock(titleText: string, contentText: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "detail-block";

  const title = document.createElement("h4");
  title.textContent = titleText;

  const body = document.createElement("p");
  body.textContent = contentText;

  section.append(title, body);
  return section;
}

function renderRawHeaders(rawHeaders: Record<string, string[]>): void {
  const entries = Object.entries(rawHeaders).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    rawHeadersOutputEl.textContent = "(no raw headers available)";
    return;
  }

  const lines: string[] = [];

  for (const [headerName, values] of entries) {
    for (const value of values) {
      lines.push(`${headerName}: ${value}`);
    }
  }

  rawHeadersOutputEl.textContent = lines.join("\n");
}

function applyGradeBadge(grade: AnalysisResult["grade"]): void {
  gradeBadgeEl.textContent = grade;
  gradeBadgeEl.className = `grade-badge grade-${grade.toLowerCase()}`;
}

function formatObservedValues(values: string[]): string {
  if (values.length === 0) return "missing";
  return values.join(" | ");
}

function formatStatusLabel(status: Finding["status"]): string {
  switch (status) {
    case "good":
      return "Good";
    case "needs_improvement":
      return "Needs improvement";
    case "missing_or_weak":
      return "Missing / weak";
    case "informational":
      return "Informational";
    default:
      return status;
  }
}

function getStatusBadgeClass(status: Finding["status"]): string {
  switch (status) {
    case "good":
      return "status-good";
    case "needs_improvement":
      return "status-needs";
    case "missing_or_weak":
      return "status-missing";
    case "informational":
      return "status-info";
    default:
      return "status-info";
  }
}

function getSeverityClass(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "severity-critical";
    case "moderate":
      return "severity-moderate";
    case "info":
      return "severity-info";
    default:
      return "severity-info";
  }
}

function formatAnalyzedAt(isoString: string): string {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "Analyzed recently";
  }

  return `Analyzed ${date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function showState(state: "loading" | "error" | "empty" | "content"): void {
  loadingState.classList.toggle("hidden", state !== "loading");
  errorState.classList.toggle("hidden", state !== "error");
  emptyState.classList.toggle("hidden", state !== "empty");
  appContent.classList.toggle("hidden", state !== "content");
}

function showError(message: string): void {
  errorMessage.textContent = message;
  showState("error");
}

function mustGetById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required element: #${id}`);
  }
  return el;
}