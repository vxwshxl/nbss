import "server-only";

import { currentSession } from "@/lib/auth";
import type { Role } from "@/lib/auth";

/**
 * Who the assistant is answering, derived entirely from the session.
 *
 * Nothing in this object ever comes off the request body. That is the whole
 * design: the model chooses *which* question to look up, never *whose* records
 * to look it up in, so a crafted request has nothing to aim at.
 */
export type AiContext = {
  userId: string;
  name: string;
  employeeCode: string;
  role: Role;
  /** True while an admin is viewing the console as somebody else. */
  viewingAs: boolean;
  /** The real account, when `viewingAs`. Recorded in the audit row. */
  realUserId: string;
};

export async function getAiContext(): Promise<AiContext | null> {
  const session = await currentSession();
  if (!session) return null;

  return {
    userId: session.profile.id,
    name: session.profile.full_name,
    employeeCode: session.profile.employee_code,
    role: session.profile.role,
    viewingAs: session.impersonating,
    realUserId: session.realProfile.id,
  };
}

/**
 * Who the assistant thinks it is talking to.
 *
 * Only the two office roles reach the assistant at all — see the nav and the
 * route — so this is a short list on purpose rather than an unfinished one. A
 * guard's question is "am I checked in", which the duty screen answers in one
 * look and a chat box answers worse.
 */
export function audienceFor(role: Role): string {
  switch (role) {
    case "admin":
      return "an administrator of the agency, who can see every site, every guard and the audit log.";
    case "supervisor":
      return "a supervisor running deployments day to day.";
    case "guard":
      return "a guard, who may only be told about their own shifts.";
    case "client":
      return "a client, who may only be told about their own site.";
  }
}
