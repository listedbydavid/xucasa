/**
 * assignPlatformAgent.ts
 *
 * Silently assigns David Hussain (platform default agent) to any buyer who has
 * no assigned agent. Call this on: account creation, first swipe, first save,
 * and first authenticated property view.
 *
 * Central invariant: a buyer with assignedAgentUserId set to a *real* agent
 * (any ID != DAVID_USER_ID) is NEVER overwritten by this helper.
 */

import { DAVID_USER_ID, storage } from "../storage";
import { logger } from "./logger";
import { audit } from "../auditLog";

/**
 * Silently assigns David Hussain as platform default agent to any user who
 * has no assigned agent yet. No-op if the user already has an assigned agent
 * (including David — avoids redundant writes).
 *
 * @param userId  The buyer's user ID.
 * @param req     Express request object (used for audit context). May be null
 *                for non-request contexts (e.g. account creation callback).
 * @param trigger Short label describing what triggered this call.
 */
export async function assignPlatformAgentIfNeeded(
  userId: string,
  req: any,
  trigger: string = "auto",
): Promise<void> {
  try {
    const user = await storage.getUser(userId);

    // Already assigned to any agent (including David) → skip
    if (!user || user.assignedAgentUserId) return;

    // The storage method updates the assignment and active client link in one
    // transaction, conditioned on the buyer still being unassigned or assigned
    // to the platform default.
    const assigned = await storage.assignAgent(userId, DAVID_USER_ID);
    if (!assigned) return;

    await audit({
      req: req ?? {},
      event: "platform_agent_assigned",
      outcome: "success",
      userId,
      role: user.primaryIntent ?? "buyer",
      metadata: {
        assignmentType: "platform_default",
        agentId: DAVID_USER_ID,
        trigger,
      },
    });
  } catch (err) {
    // Non-fatal — log but don't crash the caller
    logger.error({
      event: "assign_platform_agent_failed",
      userId,
      trigger,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
