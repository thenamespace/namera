import { Metric } from "effect";

export const oauthAuthorizationRequestResults = Metric.counter(
  "namera.oauth.authorization_request.results",
  {
    description: "OAuth authorization request outcomes",
    incremental: true,
  },
);

export const oauthClientRegistrationResults = Metric.counter(
  "namera.oauth.client_registration.results",
  {
    description: "OAuth dynamic client registration outcomes",
    incremental: true,
  },
);

export const oauthClientRegistrationDuration = Metric.timer(
  "namera.oauth.client_registration.duration",
  { description: "Duration of OAuth dynamic client registration workflows" },
);

export const oauthConsentResults = Metric.counter("namera.oauth.consent.results", {
  description: "OAuth consent outcomes",
  incremental: true,
});

export const oauthConsentDuration = Metric.timer("namera.oauth.consent.duration", {
  description: "Duration of OAuth consent workflows",
});

export const oauthTokenResults = Metric.counter("namera.oauth.token.results", {
  description: "OAuth token endpoint outcomes",
  incremental: true,
});

export const oauthTokenDuration = Metric.timer("namera.oauth.token.duration", {
  description: "Duration of OAuth token workflows",
});

export const oauthAuthorizationRevocationResults = Metric.counter(
  "namera.oauth.authorization.revocation.results",
  {
    description: "OAuth authorization revocation outcomes",
    incremental: true,
  },
);

export const oauthAuthorizationRevocationDuration = Metric.timer(
  "namera.oauth.authorization.revocation.duration",
  {
    description: "Duration of OAuth authorization revocation workflows",
  },
);

export const oauthDeviceAuthorizationRequests = Metric.counter(
  "namera.oauth.device_authorization.requests",
  { description: "OAuth device authorization request outcomes", incremental: true },
);

export const oauthDeviceAuthorizationDecisions = Metric.counter(
  "namera.oauth.device_authorization.decisions",
  { description: "OAuth device authorization consent outcomes", incremental: true },
);

export const oauthDeviceTokenPolls = Metric.counter("namera.oauth.device_token.polls", {
  description: "OAuth device token polling outcomes",
  incremental: true,
});

export const cliAuthorizations = Metric.counter("namera.cli.authorizations", {
  description: "CLI authorization lifecycle outcomes",
  incremental: true,
});

export const mcpAuthenticationResults = Metric.counter("namera.mcp.authentication.results", {
  description: "MCP bearer authentication outcomes",
  incremental: true,
});
