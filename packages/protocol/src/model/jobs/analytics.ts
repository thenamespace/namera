import { Schema } from "effect";

import { SupportedEvmChainId } from "#/evm/chains";

// A deliberately narrow payload. Audit data and operation bodies never enter this queue.
export const ProductMilestoneProperties = Schema.Struct({
  workspace_id: Schema.optionalKey(Schema.String),
  actor_kind: Schema.optionalKey(Schema.String),
  resource_id: Schema.optionalKey(Schema.String),
  chain_id: Schema.optionalKey(SupportedEvmChainId),
  namespace: Schema.optionalKey(Schema.String),
  stage: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(Schema.String),
});

export const ProductMilestone = Schema.Struct({
  event: Schema.Literals([
    "signup_completed",
    "login_completed",
    "workspace_created",
    "account_created",
    "session_key_created",
    "session_key_revoked",
    "session_installation_confirmed",
    "session_installation_failed",
    "api_key_created",
    "api_key_revoked",
    "mcp_connected",
    "mcp_disconnected",
    "cli_connected",
    "cli_disconnected",
    "execution_prepared",
    "session_installation_prepared",
    "execution_submitted",
    "execution_confirmed",
    "execution_failed",
    "signing_completed",
    "waitlist_joined",
    "workspace_activated",
    "integration_first_request_succeeded",
  ]),
  distinctId: Schema.String,
  properties: ProductMilestoneProperties,
});
export type ProductMilestone = typeof ProductMilestone.Type;

export const AnalyticsJob = Schema.Struct({
  id: Schema.String,
  dedupeKey: Schema.String,
  payload: Schema.NullOr(ProductMilestone),
  createdAt: Schema.DateTimeUtcFromDate,
  availableAt: Schema.DateTimeUtcFromDate,
  deliveredAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  attempts: Schema.Number,
  leaseToken: Schema.NullOr(Schema.String),
});
export type AnalyticsJob = typeof AnalyticsJob.Type;
