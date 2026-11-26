import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Every value a list row holds, as one lower-case string, for a search box that
 * should find whatever the row shows (names, codes, sites, states, numbers, dates),
 * not only the fields someone remembered to list. Nested objects are read too;
 * ids are left out.
 */
export function searchText(value: unknown, depth = 0): string {
  if (value == null || depth > 4) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  if (value instanceof Date) return value.toISOString().toLowerCase();
  if (Array.isArray(value)) return value.map((v) => searchText(v, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "id" && !k.endsWith("Id") && !k.endsWith("_id"))
      .map(([, v]) => searchText(v, depth + 1))
      .join(" ");
  }
  return "";
}

/** True when every word of the query appears somewhere in the row. */
export function matchesSearch(query: string, row: unknown): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = searchText(row);
  return words.every((w) => text.includes(w));
}
