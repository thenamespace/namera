export const cryptoPurpose = {
  magicLinkToken: "auth.magic-link.token",
  magicLinkCode: "auth.magic-link.code",
  sessionToken: "auth.session.token",
  apiKey: "auth.api-key",
  emailOutbox: "email.outbox.payload",
  sessionKeyPolicies: "session-key.policies",
  executionRequest: "execution.request",
  oauthAuthorizationCode: "auth.oauth.authorization-code",
  oauthAccessToken: "auth.oauth.access-token",
  oauthRefreshToken: "auth.oauth.refresh-token",
} as const;
