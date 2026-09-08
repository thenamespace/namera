import { Predicate } from "effect";

export type FeedbackMessage = {
  readonly description?: string;
  readonly title: string;
};

type ErrorMessageResolver = FeedbackMessage | ((error: object) => FeedbackMessage);

const errorMessages: Readonly<Record<string, ErrorMessageResolver>> = {
  Unauthorized: {
    title: "Sign in required",
    description: "Sign in again, then retry this action.",
  },
  Forbidden: {
    title: "Permission denied",
    description: "Your current role does not allow this action.",
  },
  ForbiddenNoContent: {
    title: "Permission denied",
    description: "Your current role does not allow this action.",
  },
  InternalServerError: {
    title: "Something went wrong",
    description: "The server could not complete the request. Try again shortly.",
  },
  InternalServerErrorNoContent: {
    title: "Something went wrong",
    description: "The server could not complete the request. Try again shortly.",
  },
  RateLimitExceeded: (error) => {
    const retryAfter = Reflect.get(error, "retryAfterSeconds");

    return {
      title: "Too many requests",
      description:
        typeof retryAfter === "number"
          ? `Try again in ${retryAfter} seconds.`
          : "Wait a moment before trying again.",
    };
  },
  "MagicLinkError:INVALID_OR_EXPIRED_LINK": {
    title: "This link is no longer valid",
    description: "Request a new magic link to continue.",
  },
  "MagicLinkError:TOO_MANY_ATTEMPTS": {
    title: "Too many attempts",
    description: "Request a new magic link and try again.",
  },
  "OrganizationError:ORGANIZATION_NOT_FOUND": {
    title: "Workspace not found",
    description: "It may have been removed or you may no longer have access.",
  },
  "OrganizationError:INSUFFICIENT_PERMISSIONS": {
    title: "Permission denied",
    description: "Your workspace role does not allow this action.",
  },
  "OrganizationMemberError:ORGANIZATION_MEMBER_NOT_FOUND": {
    title: "Member not found",
    description: "The member may have already left this workspace.",
  },
  "InvitationError:INVITATION_NOT_FOUND": {
    title: "Invitation unavailable",
    description: "It may have expired, been cancelled, or already been used.",
  },
  "InvitationError:ALREADY_A_MEMBER": {
    title: "Already a member",
    description: "This person already belongs to the workspace.",
  },
  "InvitationError:INVITATION_RECIPIENT_MISMATCH": {
    title: "Different email required",
    description: "Sign in with the email address that received this invitation.",
  },
  "BillingError:LIMIT_EXCEEDED": (error) => {
    const limit = Reflect.get(error, "limit");
    const resource =
      limit === "members"
        ? "member"
        : limit === "hsmWallets"
          ? "HSM account"
          : limit === "softwareWallets"
            ? "software account"
            : limit === "localWallets"
              ? "user-owned account"
              : "execution";

    return {
      title: "Plan limit reached",
      description: `Your current plan does not include another ${resource}.`,
    };
  },
  "WalletError:WALLET_NOT_FOUND": {
    title: "Account not found",
    description: "It may have been removed or belongs to another workspace.",
  },
  "SessionKeyError:SESSION_KEY_NOT_FOUND": {
    title: "Session key not found",
    description: "It may have been revoked or belongs to another workspace.",
  },
  "SessionKeyCreationError:TIME_WINDOW_EXPIRED": {
    title: "Invalid time window",
    description: "Choose an expiration time in the future.",
  },
  "SessionKeyCreationError:WALLET_NOT_ACTIVE": {
    title: "Account unavailable",
    description: "Select an active account and try again.",
  },
  "SessionKeyCreationError:WALLET_NAMESPACE_MISMATCH": {
    title: "Policy does not match the account",
    description: "Use policies supported by the selected account namespace.",
  },
  "SessionKeyCreationError:LOCAL_SIGNER_INVALID": {
    title: "Invalid session signer",
    description: "Generate a new local session key and try again.",
  },
  "SessionKeyCreationError:SIGNER_ALREADY_REGISTERED": {
    title: "Session signer already registered",
    description: "Continue with the existing session key instead of registering it again.",
  },
  "SessionKeyCreationError:WALLET_OWNER_UNAVAILABLE": {
    title: "Account owner unavailable",
    description: "Select an active passkey-owned account.",
  },
  "SessionKeyOperationError:INSTALLATION_UNAVAILABLE": {
    title: "Installation unavailable",
    description: "Refresh the session key to check its current network installations.",
  },
  "SessionKeyOperationError:OPERATION_UNAVAILABLE": {
    title: "Approval operation unavailable",
    description: "Check the active workspace and refresh the session key.",
  },
  "SessionKeyOperationError:OWNER_UNAVAILABLE": {
    title: "Account owner unavailable",
    description: "The account needs an active owner passkey to approve this operation.",
  },
  "SessionKeyOperationError:INVALID_TRANSITION": {
    title: "Session key state changed",
    description: "Refresh its installations before approving another operation.",
  },
  "SessionKeyOperationError:OPERATION_BUSY": {
    title: "Another approval is in progress",
    description: "Wait for the existing account operation to finish before trying again.",
  },
  "SessionKeyOperationError:IDEMPOTENCY_CONFLICT": {
    title: "Approval request changed",
    description: "Refresh the session key before starting a new approval.",
  },
  "SessionKeyOperationError:APPROVAL_EXPIRED": {
    title: "Approval expired",
    description: "Prepare a new operation and approve it with your passkey.",
  },
  "SessionKeyOperationError:APPROVAL_INVALID": {
    title: "Passkey approval could not be verified",
    description: "Use the passkey that owns this account and try again.",
  },
  "SessionKeyOperationError:PREPARATION_FAILED": {
    title: "Couldn’t prepare the approval",
    description: "The network could not prepare this operation. Try again shortly.",
  },
  "ApiKeyError:API_KEY_NOT_FOUND": {
    title: "API key not found",
    description: "It may have already been revoked.",
  },
  "ApiKeyCreationError:SESSION_KEY_NOT_ACTIVE": {
    title: "Session key unavailable",
    description: "Select only active session keys and try again.",
  },
};

export const getErrorMessage = (error: unknown, fallback: FeedbackMessage): FeedbackMessage => {
  if (!Predicate.isObject(error)) return fallback;

  const tag = Reflect.get(error, "_tag");
  const code = Reflect.get(error, "code");
  const keys = [
    typeof tag === "string" && typeof code === "string" ? `${tag}:${code}` : undefined,
    typeof tag === "string" ? tag : undefined,
  ];

  for (const key of keys) {
    if (key === undefined) continue;

    const message = errorMessages[key];
    if (message !== undefined) return typeof message === "function" ? message(error) : message;
  }

  return fallback;
};
