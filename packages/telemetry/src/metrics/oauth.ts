import { Metric } from "effect";

export const oauthAuthorizationRequestResults = Metric.counter(
  "namera.oauth.authorization_request.results",
  {
    description: "OAuth authorization request outcomes",
    incremental: true,
  },
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

export const mcpAuthorizationRevocationResults = Metric.counter(
  "namera.mcp_authorization.revocation.results",
  {
    description: "MCP authorization revocation outcomes",
    incremental: true,
  },
);

export const mcpAuthorizationRevocationDuration = Metric.timer(
  "namera.mcp_authorization.revocation.duration",
  {
    description: "Duration of MCP authorization revocation workflows",
  },
);
