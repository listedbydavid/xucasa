import { authStorage } from "../replit_integrations/auth/storage";
import { verifyAgentLicense } from "../idxSync";
import { audit } from "../auditLog";

export async function runAgentVerificationFlow(
  req: any,
  userId: string,
  input: { licenseNumber: string; licenseState: string | null; association: string | null; brokerageName: string | null },
): Promise<{ verified: boolean; user?: any; mlsInfo?: { memberName?: string; officeName?: string; memberEmail?: string }; error?: string }> {
  const result = await verifyAgentLicense(input.licenseNumber, input.licenseState || undefined);

  if (result.verified) {
    const updated = await authStorage.updateAgentInfo(userId, {
      licenseNumber: input.licenseNumber,
      licenseState: input.licenseState,
      association: input.association,
      brokerageName: result.officeName || input.brokerageName,
      agentVerified: true,
      agentVerifiedAt: new Date(),
      agentMlsId: result.memberKey || null,
      role: "agent",
      agentVerificationStatus: "verified",
    });
    await audit({
      req,
      event: "agent_verified",
      outcome: "success",
      userId,
      metadata: { licenseNumber: input.licenseNumber, licenseState: input.licenseState, memberKey: result.memberKey },
    });
    return {
      verified: true,
      user: updated,
      mlsInfo: {
        memberName: result.memberName,
        officeName: result.officeName,
        memberEmail: result.memberEmail,
      },
    };
  }

  await authStorage.updateAgentInfo(userId, {
    licenseNumber: input.licenseNumber,
    licenseState: input.licenseState,
    association: input.association,
    brokerageName: input.brokerageName,
    agentVerified: false,
    agentVerificationStatus: "failed",
  });
  await audit({
    req,
    event: "agent_verify_failed",
    outcome: "failure",
    userId,
    metadata: { licenseNumber: input.licenseNumber, licenseState: input.licenseState, error: result.error },
  });
  return {
    verified: false,
    error: result.error || "Could not verify agent license",
  };
}
