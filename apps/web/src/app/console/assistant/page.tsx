import type { Metadata } from "next";

import { Assistant } from "@/components/ai/assistant";
import { isAssistantConfigured } from "@/lib/ai/assistant";
import { personaFor } from "@/lib/ai/personas";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

/**
 * Every role has an assistant; they are not the same assistant.
 *
 * What differs is not the wording on this page but the tools the role is
 * offered underneath it — an admin gets the duty board, the site register and
 * the enquiry desk; a guard gets exactly one lookup, their own shifts; a client
 * gets exactly one, the cover at their own site. So the greeting, the
 * suggestions and the scope note all come from the same `personaFor` table the
 * system prompt reads, and the tool catalogue is filtered by role in
 * `lib/ai/tools`. A role cannot be shown a suggestion it has no way to answer.
 */
export default async function AssistantPage() {
  const { profile } = await requireSession();
  const persona = personaFor(profile.role);

  return (
    <Assistant
      greetingName={profile.full_name.split(" ")[0] ?? profile.full_name}
      suggestions={persona.suggestions}
      configured={isAssistantConfigured()}
      scopeNote={persona.scopeNote}
    />
  );
}
