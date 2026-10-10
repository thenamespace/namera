import { Predicate } from "effect";

export type FeedbackMessage = {
  readonly description?: string;
  readonly title: string;
};

type ErrorMessageResolver = FeedbackMessage | ((error: object) => FeedbackMessage);

const networkPaused: FeedbackMessage = {
  title: "Network paused",
  description: "New operations are unavailable on this network. Try again after it is re-enabled.",
};

const errorMessages: Readonly<Record<string, ErrorMessageResolver>> = {
  "GoogleAuthError:GOOGLE_NOT_CONFIGURED": {
    title: "Google sign-in unavailable",
    description: "Use email to sign in for now.",
  },
  "GoogleAuthError:GOOGLE_UNAVAILABLE": {
    title: "Couldn’t reach Google",
    description: "Try again shortly, or continue with email.",
  },
  "GoogleAuthError:GOOGLE_IDENTITY_INVALID": {
    title: "Couldn’t verify Google sign-in",
    description: "Start Google sign-in again, or continue with email.",
  },
  "GoogleAuthError:GOOGLE_FLOW_INVALID": {
    title: "Google sign-in expired",
    description:
      "Start again in this browser. Only the most recent Google sign-in attempt can be completed.",
  },
  "GoogleAuthError:GOOGLE_CANCELED": {
    title: "Google sign-in canceled",
    description: "Try again when you’re ready, or continue with email.",
  },
  "GoogleAuthError:GOOGLE_ACCOUNT_EXISTS": {
    title: "Sign in with email first",
    description:
      "An account already uses this email. Sign in with email, then connect Google in Security settings.",
  },
  "GoogleAuthError:GOOGLE_ALREADY_LINKED": {
    title: "Google account already connected",
    description:
      "Disconnect the current Google account before connecting another. A Google account can only belong to one Namera user.",
  },
  "GoogleAuthError:GOOGLE_ACCOUNT_NOT_FOUND": {
    title: "Google account no longer connected",
    description: "Refresh Security settings to see your current connections.",
  },
  "GoogleAuthError:REAUTHENTICATION_REQUIRED": {
    title: "Sign in again to continue",
    description:
      "For security, connecting or disconnecting Google requires a sign-in within the last 10 minutes.",
  },
  "GoogleAuthError:EMAIL_LOGIN_REQUIRED": {
    title: "Confirm your email",
    description:
      "We sent a sign-in email to your Google email address. Open it to finish, or continue with email to enter the code.",
  },
  "BetaInviteError:INVITE_REQUIRED_OR_UNAVAILABLE": {
    title: "Invite unavailable",
    description: "Check your invite code and email, or ask your teammate for a new invite.",
  },
  "ExecutionError:NETWORK_PAUSED": networkPaused,
  "SignatureError:NETWORK_PAUSED": networkPaused,
  "SessionKeyCreationError:NETWORK_PAUSED": networkPaused,
  "SessionKeyOperationError:NETWORK_PAUSED": networkPaused,
  "SessionKeyCreationError:ONCHAIN_PREPARATION_FAILED": {
    title: "Network unavailable",
    description: "A selected network could not prepare this session. Try again later.",
  },
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
    description: "Check your code or request a new sign-in email.",
  },
  "MagicLinkError:TOO_MANY_ATTEMPTS": {
    title: "Too many attempts",
    description: "Request a new sign-in email and try again.",
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
    if (limit === "ownedOrganizations")
      return {
        title: "Workspace limit reached",
        description:
          "You can own up to 3 workspaces, including Personal. You can still join other workspaces.",
      };
    if (limit === "localSessionKeys" || limit === "oneClawSessionKeys")
      return {
        title: "Session key limit reached",
        description: "Revoke an unused key or wait for a key to expire before creating another.",
      };
    if (limit === "oneClawWallets")
      return {
        title: "Managed account limit reached",
        description: "Your workspace has reached its 1Claw-managed account allowance.",
      };
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
  "WalletCreationError:PROVIDER_SETUP_FAILED": {
    title: "1Claw setup unavailable",
    description:
      "Wait for workspace setup to finish, then try again. Contact support if this continues.",
  },
  "WalletCreationError:PROVIDER_RECOVERY_REQUIRED": {
    title: "Account setup needs recovery",
    description:
      "Do not create another account yet. Contact support to recover the provider setup.",
  },
  "WalletCustodyUnavailableError:MANAGED_WALLETS_DISABLED": {
    title: "Provider unavailable",
    description: "Choose a user-owned passkey or 1Claw Managed account.",
  },
  "SessionKeyError:SESSION_KEY_NOT_FOUND": {
    title: "Session key not found",
    description: "It may have been revoked or belongs to another workspace.",
  },
  "SessionKeyCreationError:PROVIDER_SETUP_FAILED": {
    title: "1Claw setup unavailable",
    description: "Check workspace setup with an admin before trying again.",
  },
  "SessionKeyCreationError:PROVIDER_RECOVERY_REQUIRED": {
    title: "Session key setup needs recovery",
    description: "Do not create another key yet. Contact support to recover the provider setup.",
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
    description: "Select an active passkey or 1Claw Managed account.",
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
    description: "The account owner is unavailable. Refresh the account before retrying.",
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
    description: "Prepare a new operation and approve it with your account owner.",
  },
  "SessionKeyOperationError:APPROVAL_INVALID": {
    title: "Owner approval could not be verified",
    description: "Refresh the account and review the approval again.",
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
