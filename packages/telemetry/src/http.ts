const staticHttpRoutes = new Set([
  "/",
  "/auth/invitation/accept-invitation",
  "/auth/invitation/cancel-invitation",
  "/auth/invitation/get-invitation",
  "/auth/invitation/invite-member",
  "/auth/invitation/list-invitations",
  "/auth/invitation/list-user-invitations",
  "/auth/invitation/reject-invitation",
  "/auth/magic-link/request",
  "/auth/magic-link/verify",
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
  "/auth/session/sessions",
  "/auth/session/sessions/logout",
  "/auth/session/sessions/revoke",
  "/auth/user/update-user",
  "/billing",
  "/health",
  "/openapi.json",
  "/reference",
  "/session-keys",
  "/t/logs/v1",
  "/t/metrics/v1",
  "/t/traces/v1",
  "/wallets",
]);

export const httpRouteTemplate = (url: string): string => {
  const pathname = new URL(url, "http://localhost").pathname.replace(/\/$/, "") || "/";

  if (staticHttpRoutes.has(pathname)) {
    return pathname;
  }
  if (/^\/wallets\/[^/]+$/.test(pathname)) {
    return "/wallets/:walletId";
  }
  if (/^\/session-keys\/wallets\/[^/]+$/.test(pathname)) {
    return "/session-keys/wallets/:walletId";
  }
  if (/^\/session-keys\/[^/]+$/.test(pathname)) {
    return "/session-keys/:sessionKeyId";
  }
  if (/^\/rpc\/eip155\/[^/]+$/.test(pathname)) {
    return "/rpc/eip155/:chainId";
  }

  return "/*";
};

export const httpStatusClass = (status: number): string => `${Math.floor(status / 100)}xx`;
