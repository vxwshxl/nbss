// Client-safe pieces of Test / Live mode (see 0036_test_live.sql).

/** Readable by the browser too: its Supabase client sends the mode as a header. */
export const DATA_MODE_COOKIE = "nbss-data-mode";
export const DATA_MODE_HEADER = "x-nbss-mode";

export type DataMode = "live" | "test";

export function parseMode(value: string | undefined | null): DataMode {
  return value === "test" ? "test" : "live";
}
