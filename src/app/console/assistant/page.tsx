import type { Metadata } from "next";

import { Assistant } from "@/components/ai/assistant";
import { isAssistantConfigured } from "@/lib/ai/assistant";
import { requireRoleSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

/**
 * Suggestions worth a tap.
 *
 * Each one is a question this product can genuinely answer from a lookup, and
 * each is phrased the way somebody at the desk would actually say it. A prompt
 * chip that produces "I don't have that" is worse than no chip: it teaches the
 * reader the whole feature is decorative.
 */
const SUGGESTIONS = [
  "Who is on duty right now?",
  "Which sites have nobody in them?",
  "How many hours were worked this week?",
  "Is anything waiting for review?",
  "What has come in on the enquiry forms?",
  "How much overtime went out in the last 30 days?",
];

export default async function AssistantPage() {
  // Office roles only — the same gate the route enforces, so a stale link
  // lands somewhere sensible rather than on a screen that refuses every turn.
  const { profile } = await requireRoleSession("admin", "supervisor");

  return (
    <Assistant
      greetingName={profile.full_name.split(" ")[0] ?? profile.full_name}
      suggestions={SUGGESTIONS}
      configured={isAssistantConfigured()}
      scopeNote="I read this console's own records — duty, sites, hours, the roster and the enquiry desk. I can't see anything the console can't, I don't change anything, and every figure I give you names the lookup it came from."
    />
  );
}
