import type { HeaderMap } from "./types";

export function getHeaderValues(headers: HeaderMap, name: string): string[] {
  return headers[name.toLowerCase()] ?? [];
}

export function getCanonicalHeaderValue(headers: HeaderMap, name: string): string {
  return getHeaderValues(headers, name)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseDirectives(headerValue: string): Map<string, string[]> {
  const directiveMap = new Map<string, string[]>();

  for (const rawPart of headerValue.split(";")) {
    const trimmed = rawPart.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const directiveName = tokens[0].toLowerCase();
    const directiveValues = tokens.slice(1);

    directiveMap.set(directiveName, directiveValues);
  }

  return directiveMap;
}

export function safeIncludesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}