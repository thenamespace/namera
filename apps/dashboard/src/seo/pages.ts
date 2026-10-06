import type { FileRoutesById } from "@/routeTree.gen";

import { defaultSeo, type PageSeo } from "./site";

const signIn: PageSeo = {
  title: "Sign in to your dashboard",
  description:
    "Sign in to Namera to manage agent wallets, session keys, spending permissions, and your workspace.",
  indexable: true,
};
const account: PageSeo = {
  title: "Overview",
  description:
    "Review your account status, network addresses, ownership, and permissions in Namera.",
};
const session: PageSeo = {
  title: "Overview",
  description:
    "Review your session key status, expiration, account access, and network approvals in Namera.",
};
const usage: PageSeo = {
  title: "Usage",
  description: "Review onchain executions and activity for this Namera session key.",
};
const mcp: PageSeo = {
  title: "MCP",
  description: "Connect your agents to Namera with MCP and manage their authorized session keys.",
};

// Exhaustive against the generated route tree: a new route must have metadata.
export const pageSeo = {
  __root__: defaultSeo,
  "/_authenticated": defaultSeo,
  "/auth": signIn,
  "/auth/": signIn,
  "/auth/invite": {
    title: "Enter your invite code",
    description: "Enter your invitation code to finish setting up your Namera workspace.",
  },
  "/auth/verify": {
    title: "Verify your email",
    description: "Confirm your email to sign in to your Namera workspace.",
  },
  "/_authenticated/": {
    title: "Overview",
    description:
      "See your Namera accounts, session keys, agent activity, and recent executions in one place.",
  },
  "/_authenticated/activity": {
    title: "Activity",
    description:
      "Review onchain executions across your Namera accounts, networks, and session keys.",
  },
  "/_authenticated/inbox": {
    title: "Inbox",
    description:
      "Review account updates, access notifications, and workspace activity in your Namera inbox.",
  },
  "/_authenticated/mcp": mcp,
  "/_authenticated/accounts/": {
    title: "Accounts",
    description:
      "Manage your Namera smart accounts, review their status, and open account details.",
  },
  "/_authenticated/accounts/new": {
    title: "Create an account",
    description: "Create a passkey-protected Namera smart account for your agents.",
  },
  "/_authenticated/account/$accountId": account,
  "/_authenticated/account/$accountId/": account,
  "/_authenticated/account/$accountId/overview": account,
  "/_authenticated/account/$accountId/assets": {
    title: "Assets",
    description:
      "Review token balances and portfolio holdings across your account's supported networks.",
  },
  "/_authenticated/account/$accountId/session-keys": {
    title: "Session Keys",
    description:
      "Manage the session keys and delegated access associated with this Namera account.",
  },
  "/_authenticated/account/$accountId/usage": {
    title: "Usage",
    description: "Review execution history and onchain activity for this Namera account.",
  },
  "/_authenticated/session-keys/": {
    title: "Session Keys",
    description:
      "Manage agent access with Namera session keys, scoped permissions, spending limits, and expiration dates.",
  },
  "/_authenticated/session-keys/new": {
    title: "Create a session key",
    description:
      "Define agent permissions, encrypt your session key, import it into the CLI, and approve network access.",
  },
  "/_authenticated/session-key/$sessionKeyId": session,
  "/_authenticated/session-key/$sessionKeyId/": session,
  "/_authenticated/session-key/$sessionKeyId/overview": session,
  "/_authenticated/session-key/$sessionKeyId/policies": {
    title: "Policies",
    description:
      "Review contract access, spending limits, signature permissions, and network approvals for your session key.",
  },
  "/_authenticated/session-key/$sessionKeyId/usage": usage,
  "/_authenticated/session-key/$sessionKeyId/executions": usage,
  "/_authenticated/execution/$executionId": {
    title: "Execution",
    description:
      "Review an onchain execution's status, account, network, and transaction details in Namera.",
  },
  "/_authenticated/invitations/$invitationId": {
    title: "Workspace invitation",
    description: "Review and respond to your invitation to join a Namera workspace.",
  },
  "/_authenticated/cli/authorize": {
    title: "Authorize the CLI",
    description:
      "Review a Namera CLI authorization request and choose which session keys it can access.",
  },
  "/_authenticated/oauth/authorize": {
    title: "Authorize a connection",
    description:
      "Review a connection request and approve scoped access to your Namera session keys.",
  },
  "/_authenticated/workspace/new": {
    title: "Create a workspace",
    description: "Create a Namera workspace to organize your accounts, agent access, and team.",
  },
  "/_authenticated/settings/profile": {
    title: "Profile",
    description: "Update your name and profile image in Namera.",
  },
  "/_authenticated/settings/notifications": {
    title: "Notifications",
    description: "Choose which account, product, and workspace emails you receive from Namera.",
  },
  "/_authenticated/settings/security": {
    title: "Security",
    description: "Review your signed-in devices and manage active Namera login sessions.",
  },
  "/_authenticated/settings/workspace/": {
    title: "Workspace",
    description: "Update your Namera workspace name, logo, and details.",
  },
  "/_authenticated/settings/workspace/members": {
    title: "Members",
    description: "Manage workspace members, roles, and team invitations in Namera.",
  },
  "/_authenticated/settings/workspace/api-keys": {
    title: "API keys",
    description:
      "Create and manage API credentials with scoped session-key access for your Namera integrations.",
  },
  "/_authenticated/settings/workspace/billings": {
    title: "Billing",
    description: "Review your Namera plan, included allowances, current usage, and reset date.",
  },
  "/_authenticated/settings/workspace/cli-authorizations": {
    title: "CLI access",
    description:
      "Review authorized CLI devices and revoke their access to your Namera session keys.",
  },
  "/_authenticated/settings/workspace/mcp": mcp,
} satisfies Record<keyof FileRoutesById, PageSeo>;

export const notFoundSeo: PageSeo = {
  title: "Page not found",
  description: "This Namera page could not be found. Return to your dashboard to continue.",
};
export const errorSeo: PageSeo = {
  title: "Unable to load page",
  description: "Namera could not load this page. Reload to try again.",
};
