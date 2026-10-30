/**
 * The shared vocabulary, re-exported for convenience.
 *
 * Deep imports (`@nbss/shared/geo`) are preferred in the Expo app, where every
 * module reached from the entry point is parsed at startup and a barrel drags in
 * the whole package to use one function.
 */
export * from "./company";
export * from "./identity";
export * from "./geo";
export * from "./location";
export * from "./sos";
// Both geo and location name a type Fix; the barrel takes geo's (deep imports pick their own).
export type { Fix } from "./geo";
export * from "./realtime";
export type { Database, Enums, Json, Row, View } from "./db";
