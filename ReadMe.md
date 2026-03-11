# HeaderGuard

HeaderGuard is a Chrome extension that analyzes the current page’s main document HTTP response headers and explains browser-facing security signals in a simple, local-first way.

It shows:

- overall score
- letter grade
- per-header findings
- top risks
- plain-language explanations
- remediation guidance
- raw header view

## Why this exists

Security headers are important browser-side security signals, but most users and many developers do not inspect them directly.

HeaderGuard is designed to make those signals easier to understand without sending browsing data to external services.

## Trust statement

This extension analyzes response headers locally in your browser and does not transmit browsing data to external servers.

## What the extension does

HeaderGuard currently analyzes the active tab’s **main document response headers** and evaluates a defined set of browser-relevant security headers.

Current MVP focus:

- Strict-Transport-Security
- Content-Security-Policy
- X-Frame-Options / frame-ancestors
- Referrer-Policy
- Permissions-Policy
- X-Content-Type-Options
- COOP / COEP / CORP

## What data it accesses

The extension accesses only what is needed to analyze the current page’s main response headers:

- active tab context needed to map the current page
- main-frame HTTP response headers
- temporary session/local extension storage for recent analysis results

## What it does **not** collect

HeaderGuard does **not** collect or upload:

- page content
- form content
- request bodies
- account data
- browsing history beyond what is needed for current operation
- remote telemetry
- remote analytics
- visited URLs sent to external services
- response headers sent to external services

## Privacy model

All analysis happens locally inside the browser extension.

There are:

- no external API calls
- no cloud sync
- no account system
- no external analytics
- no background upload of results

## Permission justification

### `webRequest`
Used to observe the current page’s main document response headers.

### `tabs`
Used to identify the active tab and map analysis results to the current page.

### `storage`
Used to temporarily cache recent analysis results for popup rendering and session UX.

### `host_permissions: <all_urls>`
Used so the extension can reliably observe main-frame response headers for the current page during MVP. This may be narrowed later.

## Scope boundaries

### In scope
- current page main document response only
- local header analysis
- score, grade, findings, explanations, remediation
- raw header display
- top 3 risk summary

### Out of scope
- full-site crawling
- subresource-wide traffic analysis
- historical cross-session tracking
- cloud sync
- external services
- deep formal CSP auditing
- full vulnerability scanning

## Important limitations

HeaderGuard provides **heuristic browser-signal analysis**, not proof of full site security.

A site can have weak header signals and still have other strong security controls.
A site can also have strong headers and still have other security problems.

The extension is intended to help users interpret browser-visible security signals, not to make absolute vulnerability claims.

## Scoring model

Initial weighted scoring model:

- Content-Security-Policy: 30
- Strict-Transport-Security: 20
- Clickjacking defense: 15
- Referrer-Policy: 10
- Permissions-Policy: 10
- X-Content-Type-Options: 5
- COOP / COEP / CORP: 10

Total: 100

Letter grades:

- A
- B
- C
- D
- F

Scoring is intentionally heuristic and may evolve over time.

## UI wording philosophy

HeaderGuard avoids overstating results.

Preferred language:

- “No clickjacking protection signal detected”
- “CSP present but appears permissive”
- “Security posture is limited by missing HSTS”

It intentionally avoids absolute claims such as:

- “This site is definitely insecure”
- “This proves the site is vulnerable”

## Repository structure

```text
headerguard/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ scripts/
│  └─ build.mjs
├─ icons/
├─ src/
│  ├─ background/
│  │  └─ service_worker.ts
│  ├─ analyzer/
│  │  ├─ index.ts
│  │  ├─ normalize.ts
│  │  ├─ scoring.ts
│  │  ├─ summary.ts
│  │  ├─ types.ts
│  │  └─ rules/
│  ├─ popup/
│  │  ├─ popup.html
│  │  ├─ popup.ts
│  │  └─ popup.css
└─ dist/