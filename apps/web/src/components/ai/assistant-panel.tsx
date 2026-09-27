"use client";

import { createContext, useContext } from "react";

/**
 * How the assistant knows it is in the side panel.
 *
 * The shell receives the assistant as an already-rendered node from a Server
 * Component layout, so it cannot pass it props — but it can wrap it, and
 * context crosses that boundary where `cloneElement` would only work by
 * guessing at the node's shape.
 *
 * `null` is the standalone `/assistant` page: no panel, nothing to close, so
 * the assistant draws its own page header and card.
 */
export type AssistantPanel = {
  /** Whether the panel is showing — the composer takes focus when it opens. */
  open: boolean;
  close: () => void;
};

export const AssistantPanelContext = createContext<AssistantPanel | null>(null);

export function useAssistantPanel() {
  return useContext(AssistantPanelContext);
}
