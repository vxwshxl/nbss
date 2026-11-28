/** The visiting card's three designs, in the order /card shows them. Drawn by render.tsx. */
export const DESIGNS = [
  { id: "daylight", name: "Daylight", note: "White, with the trained batch beside the name" },
  { id: "night", name: "Night watch", note: "Dark, with the night parade at the stadium" },
  { id: "parade", name: "Parade", note: "NBSS green, with the full company on parade" },
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];
export type Side = "front" | "back";
