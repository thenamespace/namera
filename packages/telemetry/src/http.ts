const staticHttpRoutes = new Set([
  "/",
  "/auth/google/configuration",
  "/auth/google/start",
  "/auth/google/callback",
  "/auth/connected-accounts",
  "/auth/connected-accounts/google",
  "/auth/invitation/accept-invitation",
  "/auth/invitation/cancel-invitation",
  "/auth/invitation/get-invitation",
  "/auth/invitation/invite-member",
  "/auth/invitation/list-invitations",
  "/auth/invitation/list-user-invitations",
  "/auth/invitation/reject-invitation",
  "/auth/magic-link/request",
  "/auth/magic-link/verify",
  "/auth/magic-link/redeem-invite",
  "/auth/member/list-assignable-roles",
  "/auth/member/list-org-members",
  "/auth/member/list-org-roles",
  "/auth/member/remove-member",
  "/auth/member/update-member-role",
  "/auth/notification",
  "/auth/notification/archive",
  "/auth/notification/mark-all-read",
  "/auth/notification/mark-read",
  "/auth/notification/preferences",
  "/auth/notification/preferences/reset",
  "/auth/notification/preferences/update",
  "/auth/notification/unread-count",
  "/auth/organization/create-organization",
  "/auth/organization/get-organization",
  "/auth/organization/list-user-organizations",
  "/auth/organization/set-active-organization",
  "/auth/organization/update-organization",
  "/auth/session/me",
  "/auth/session/actor",
  "/auth/session/sessions",
  "/auth/session/sessions/logout",
  "/auth/session/sessions/revoke",
  "/auth/user/update-user",
  "/api-keys",
  "/billing",
  "/dashboard/overview",
  "/ens/availability",
  "/executions",
  "/executions/prepare",
  "/executions/complete",
  "/executions/simulate",
  "/address-metadata/resolve",
  "/address-metadata/search",
  "/portfolios/assets/query",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/oauth/authorize",
  "/oauth/register",
  "/oauth/token",
  "/oauth/revoke",
  "/oauth/device/authorize",
  "/oauth/authorization-requests/approve",
  "/oauth/authorization-requests/deny",
  "/oauth/device-authorizations",
  "/oauth/device-authorizations/approve",
  "/oauth/device-authorizations/deny",
  "/oauth/authorizations",
  "/oauth/authorizations/revoke",
  "/oauth/cli-authorizations",
  "/oauth/cli-authorizations/revoke",
  "/health",
  "/openapi.json",
  "/reference",
  "/session-keys",
  "/session-keys/operations/prepare",
  "/session-keys/operations/complete",
  "/signatures",
  "/signatures/prepare",
  "/signatures/complete",
  "/signatures/verify",
  "/t/logs/v1",
  "/t/metrics/v1",
  "/t/traces/v1",
  "/wallets",
  "/wallets/passkey/registration-options",
  "/waitlist",
  "/internal/me",
  "/internal/invites",
  "/internal/waitlist",
  "/internal/overview",
  "/auth/platform/logout",
  "/internal/members",
  "/internal/ownership/transfer",
  "/internal/member-invitations",
  "/auth/platform-invitations/accept",
]);

const dynamicHttpRoutes = [
  "/internal/invites/:id",
  "/internal/waitlist/:id/accept",
  "/internal/members/:id/role",
  "/internal/members/:id/status",
  "/internal/members/:id",
  "/internal/member-invitations/:id",
  "/auth/connected-accounts/:accountId",
  "/api-keys/:apiKeyId/revoke",
  "/auth/session/sessions/:sessionId",
  "/wallets/:walletId/passkey-owner",
  "/wallets/:walletId/portfolio",
  "/wallets/:walletId/update",
  "/executions/submissions/:submissionId",
  "/executions/:executionId",
  "/session-keys/installations/:installationId/operations/:kind",
  "/session-keys/operations/:operationId",
  "/session-keys/:sessionKeyId/revoke",
  "/oauth/authorization-requests/:requestId",
  "/oauth/authorizations/:authorizationId",
  "/oauth/cli-authorizations/:authorizationId",
  "/address-metadata/:namespace/:chainId/:address",
].map((template) => ({
  template,
  pattern: new RegExp(`^${template.replace(/:[^/]+/g, "[^/]+")}$`),
}));

export const httpRouteTemplate = (url: string): string => {
  const pathname = new URL(url, "http://localhost").pathname.replace(/\/$/, "") || "/";

  if (staticHttpRoutes.has(pathname)) {
    return pathname;
  }
  const dynamicRoute = dynamicHttpRoutes.find(({ pattern }) => pattern.test(pathname));
  if (dynamicRoute) return dynamicRoute.template;
  if (/^\/wallets\/[^/]+$/.test(pathname)) {
    return "/wallets/:walletId";
  }
  if (/^\/session-keys\/wallets\/[^/]+$/.test(pathname)) {
    return "/session-keys/wallets/:walletId";
  }
  if (/^\/session-keys\/[^/]+$/.test(pathname)) {
    return "/session-keys/:sessionKeyId";
  }
  if (/^\/api-keys\/[^/]+$/.test(pathname)) {
    return "/api-keys/:apiKeyId";
  }
  if (/^\/rpc\/eip155\/[^/]+$/.test(pathname)) {
    return "/rpc/eip155/:chainId";
  }

  return "/*";
};

export const httpStatusClass = (status: number): string => `${Math.floor(status / 100)}xx`;
