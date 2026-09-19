import type { Role } from "@/lib/auth";

/**
 * What the assistant is, per role.
 *
 * Four audiences whose questions barely overlap, so four framings. The point of
 * keeping them in one file is that the scope note a reader is shown and the
 * tools that role is actually offered are edited side by side — the failure
 * mode of a role-scoped assistant is a greeting that promises more than the
 * tool layer will hand over, which reads as the product being broken rather
 * than as it being careful.
 *
 * `scopeNote` is shown on the empty thread, in the reader's own terms.
 * `audience` goes into the system prompt, to steer register rather than
 * permission — permission is the tool layer's job, and a line of prose is a
 * request, not a control.
 */
export type Persona = {
  audience: string;
  scopeNote: string;
  suggestions: string[];
};

export const PERSONAS: Record<Role, Persona> = {
  admin: {
    audience:
      "an administrator of the agency, who can see every site, every guard, the enquiry desk and the audit log.",
    scopeNote:
      "I read this console's own records — duty, sites, hours, the roster and the enquiry desk. I can't see anything the console can't, I don't change anything, and every figure I give you names the lookup it came from.",
    suggestions: [
      "Who is on duty right now?",
      "Which sites have nobody in them?",
      "How many hours were worked this week?",
      "Is anything waiting for review?",
      "What has come in on the enquiry forms?",
      "How much overtime went out in the last 30 days?",
    ],
  },
  supervisor: {
    audience: "a supervisor running deployments day to day.",
    scopeNote:
      "I read the duty board, the site register, the roster and the enquiry desk. I can't see anything the console can't, I don't change anything, and every figure I give you names the lookup it came from.",
    suggestions: [
      "Who is on duty right now?",
      "Which sites have nobody in them?",
      "Is anything waiting for review?",
      "How many guards arrived late today?",
      "Show me this week's hours",
      "How did Ripun's shifts go this month?",
    ],
  },
  guard: {
    audience:
      "a guard. They may only be told about their own shifts, and never about another guard.",
    scopeNote:
      "I can only see your own shifts — when you checked in and out, the hours you worked and the overtime on them. I can't see another guard's record, I can't change yours, and I can't mark you present. That is the button on your duty screen.",
    suggestions: [
      "How many hours did I work this week?",
      "Am I checked in right now?",
      "How much overtime do I have this month?",
      "When was my last shift?",
      "Which sites have I worked at?",
    ],
  },
  client: {
    audience:
      "a client of the agency. They may only be told about cover at their own site — never about a guard's personal record, their coordinates, or any other client.",
    scopeNote:
      "I can see the cover at your own site — who is checked in right now, and the man-hours and overtime behind this month's invoice. I can't see another client's site, I can't see a guard's personal record, and I don't change anything.",
    suggestions: [
      "Is anyone on my gate right now?",
      "How many man-hours this month?",
      "How much of that was overtime?",
      "How many shifts have been worked this month?",
    ],
  },
};

export function personaFor(role: Role): Persona {
  return PERSONAS[role];
}
