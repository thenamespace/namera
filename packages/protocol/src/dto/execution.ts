import { Schema } from "effect";

import {
  ActorId,
  ApiKeyId,
  ExecutionId,
  ExecutionSubmissionId,
  OAuthAuthorizationId,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyGrantId,
  WalletId,
} from "#/common/index";
import {
  EthereumAddress,
  Hex,
  SuccessfulEvmExecutionReceipt,
  SupportedEvmChainId,
  TransactionHash,
  UserOperationHash,
} from "#/evm/index";
import { ActorType } from "#/model/auth/actor";
import { ApiKeyMetadata } from "#/model/auth/core/api-key";
import {
  OAuthAuthorizationMetadata,
  OAuthAuthorizationStatus,
  OAuthScopes,
} from "#/model/auth/oauth/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { EvmExecutionData } from "#/model/core/execution";
import { SessionKeyMetadata } from "#/model/core/session-key";
import { WalletMetadata } from "#/model/core/wallet/index";
import { EvmIntentSimulation } from "#/policy/evm/context";
import { EvmPolicyDenialCode } from "#/policy/evm/decision";

import { OAuthClientResponse } from "./auth/oauth.js";
import { GetOrganizationMemberResponse } from "./auth/organization/member.js";
import { SessionKeySummaryResponse } from "./session-key/index.js";
import { WalletResponse } from "./wallet/index.js";

const EvmExecutionCallRequest = Schema.Struct({
  to: EthereumAddress,
  value: Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
  data: Hex,
});

const EvmExecutionRequestFields = {
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  calls: Schema.Array(EvmExecutionCallRequest).check(
    Schema.isMinLength(1, { message: "At least one call is required" }),
  ),
};

export const ExecuteEvmRequest = Schema.Struct({
  ...EvmExecutionRequestFields,
  sponsor: Schema.optionalKey(Schema.Boolean).annotate({
    description:
      "Whether Namera should sponsor gas through Alchemy Bundler Sponsored Operations. Defaults to true. Set false to pay gas from the smart account without consuming sponsored-gas credits.",
  }),
}).annotate({
  identifier: "ExecuteEvmRequest",
  description: "Execute EVM calls through an API key's authorized session keys",
});

export const ExecuteRequest = Schema.Union([ExecuteEvmRequest], { mode: "oneOf" }).annotate({
  identifier: "ExecuteRequest",
});

export const ExecuteRequestHeaders = Schema.Struct({
  "idempotency-key": NonEmptyString,
}).annotate({ identifier: "ExecuteRequestHeaders" });

export const SimulateEvmExecutionRequest = Schema.Struct(EvmExecutionRequestFields).annotate({
  identifier: "SimulateEvmExecutionRequest",
  description: "Simulate EVM calls without signing, submitting, or sponsoring gas",
});

export const SimulateExecutionRequest = Schema.Union([SimulateEvmExecutionRequest], {
  mode: "oneOf",
}).annotate({
  identifier: "SimulateExecutionRequest",
  description: "Simulate an execution and evaluate the current delegated session-key policies",
});

const ExecutionSimulationResponseFields = {
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  callsSucceeded: Schema.Boolean,
  simulation: EvmIntentSimulation,
};

export const ExecutionSimulationPolicyDenial = Schema.Struct({
  sessionKeyId: SessionKeyId,
  policyId: PolicyId,
  code: EvmPolicyDenialCode,
}).annotate({
  identifier: "ExecutionSimulationPolicyDenial",
  description: "The first deterministic policy denial for one delegated session key",
});

export const AllowedExecutionSimulationResponse = Schema.Struct({
  ...ExecutionSimulationResponseFields,
  allowed: Schema.Literal(true),
  sessionKeyId: SessionKeyId,
}).annotate({ identifier: "AllowedExecutionSimulationResponse" });

export const DeniedExecutionSimulationResponse = Schema.Struct({
  ...ExecutionSimulationResponseFields,
  allowed: Schema.Literal(false),
  denials: Schema.Array(ExecutionSimulationPolicyDenial).check(
    Schema.isMinLength(1, { message: "At least one policy denial is required" }),
  ),
}).annotate({ identifier: "DeniedExecutionSimulationResponse" });

export const SimulateExecutionResponse = Schema.Union(
  [AllowedExecutionSimulationResponse, DeniedExecutionSimulationResponse],
  { mode: "oneOf" },
).annotate({
  identifier: "SimulateExecutionResponse",
  description:
    "Unsigned call simulation and point-in-time policy eligibility for delegated session keys",
});

export const SubmittedEvmExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  status: Schema.Literal("submitted"),
  submissionId: ExecutionSubmissionId,
  userOperationHash: UserOperationHash,
}).annotate({ identifier: "SubmittedEvmExecutionResponse" });

export const ConfirmedEvmExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  status: Schema.Literal("confirmed"),
  submissionId: ExecutionSubmissionId,
  executionId: ExecutionId,
  receipt: SuccessfulEvmExecutionReceipt,
}).annotate({ identifier: "ConfirmedEvmExecutionResponse" });

export const ExecuteResponse = Schema.Union(
  [SubmittedEvmExecutionResponse, ConfirmedEvmExecutionResponse],
  { mode: "oneOf" },
).annotate({ identifier: "ExecuteResponse" });

export const EvmExecutionResponse = Schema.Struct({
  id: ExecutionId,
  executionSubmissionId: ExecutionSubmissionId,
  organizationId: OrganizationId,
  sessionKeyGrantId: SessionKeyGrantId,
  namespace: Schema.Literal("eip155"),
  data: EvmExecutionData,
  createdAt: Schema.DateTimeUtcFromDate,
}).annotate({ identifier: "EvmExecutionResponse" });

export const ExecutionResponse = Schema.Union([EvmExecutionResponse], { mode: "oneOf" }).annotate({
  identifier: "ExecutionResponse",
});

export const ExecutionListDetailsResponse = Schema.Struct({
  id: ExecutionId,
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  transactionHash: TransactionHash,
  createdAt: Schema.DateTimeUtcFromDate,
}).annotate({ identifier: "ExecutionListDetailsResponse" });

export const ExecutionListWalletResponse = Schema.Struct({
  id: WalletId,
  namespace: Schema.Literal("eip155"),
  address: EthereumAddress,
  metadata: WalletMetadata,
}).annotate({ identifier: "ExecutionListWalletResponse" });

export const ExecutionListSessionKeyResponse = Schema.Struct({
  id: SessionKeyId,
  namespace: Schema.Literal("eip155"),
  metadata: SessionKeyMetadata,
}).annotate({ identifier: "ExecutionListSessionKeyResponse" });

export const ExecutionListItemResponse = Schema.Struct({
  details: ExecutionListDetailsResponse,
  wallet: ExecutionListWalletResponse,
  sessionKey: ExecutionListSessionKeyResponse,
  actorType: ActorType,
}).annotate({
  identifier: "ExecutionListItemResponse",
  description: "A compact confirmed-execution projection for list surfaces",
});

const ExecutionApiKeyDetails = Schema.Struct({
  id: ApiKeyId,
  metadata: ApiKeyMetadata,
  keyStart: Schema.NonEmptyString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  ...TimestampFields,
});

const ExecutionOAuthAuthorizationDetails = Schema.Struct({
  id: OAuthAuthorizationId,
  client: OAuthClientResponse,
  scopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: OAuthAuthorizationStatus,
  metadata: OAuthAuthorizationMetadata,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  ...TimestampFields,
});

export const ExecutionUserActorDetailsResponse = Schema.Struct({
  id: ActorId,
  type: Schema.Literal("user"),
  member: GetOrganizationMemberResponse,
});

export const ExecutionApiKeyActorDetailsResponse = Schema.Struct({
  id: ActorId,
  type: Schema.Literal("api-key"),
  apiKey: ExecutionApiKeyDetails,
});

const executionOAuthActorDetailsResponse = <Type extends "mcp" | "cli">(type: Type) =>
  Schema.Struct({
    id: ActorId,
    type: Schema.Literal(type),
    authorization: ExecutionOAuthAuthorizationDetails,
  });

export const ExecutionMcpActorDetailsResponse = executionOAuthActorDetailsResponse("mcp");
export const ExecutionCliActorDetailsResponse = executionOAuthActorDetailsResponse("cli");

export const ExecutionActorDetailsResponse = Schema.Union(
  [
    ExecutionUserActorDetailsResponse,
    ExecutionApiKeyActorDetailsResponse,
    ExecutionMcpActorDetailsResponse,
    ExecutionCliActorDetailsResponse,
  ],
  { mode: "oneOf" },
).annotate({
  identifier: "ExecutionActorDetailsResponse",
  description: "Safe details for the actor that initiated a confirmed execution",
});

export const ExecutionDetailsResponse = Schema.Struct({
  execution: ExecutionResponse,
  wallet: WalletResponse,
  sessionKey: SessionKeySummaryResponse,
  actor: ExecutionActorDetailsResponse,
}).annotate({
  identifier: "ExecutionDetailsResponse",
  description: "A confirmed execution with its complete related display details",
});

export const GetExecutionSubmissionRequest = Schema.Struct({
  submissionId: ExecutionSubmissionId,
}).annotate({ identifier: "GetExecutionSubmissionRequest" });

const ExecutionSubmissionResponseCommon = {
  namespace: Schema.Literal("eip155"),
  submissionId: ExecutionSubmissionId,
};

export const PendingEvmExecutionSubmissionResponse = Schema.Struct({
  ...ExecutionSubmissionResponseCommon,
  status: Schema.Literal("submitted"),
  userOperationHash: Schema.NullOr(UserOperationHash),
}).annotate({ identifier: "PendingEvmExecutionSubmissionResponse" });

export const ConfirmedEvmExecutionSubmissionResponse = Schema.Struct({
  ...ExecutionSubmissionResponseCommon,
  status: Schema.Literal("confirmed"),
  execution: EvmExecutionResponse,
}).annotate({ identifier: "ConfirmedEvmExecutionSubmissionResponse" });

export const FailedEvmExecutionSubmissionResponse = Schema.Struct({
  ...ExecutionSubmissionResponseCommon,
  status: Schema.Literal("failed"),
}).annotate({ identifier: "FailedEvmExecutionSubmissionResponse" });

export const GetExecutionSubmissionResponse = Schema.Union(
  [
    PendingEvmExecutionSubmissionResponse,
    ConfirmedEvmExecutionSubmissionResponse,
    FailedEvmExecutionSubmissionResponse,
  ],
  { mode: "oneOf" },
).annotate({ identifier: "GetExecutionSubmissionResponse" });

export const GetExecutionRequest = Schema.Struct({
  executionId: ExecutionId,
}).annotate({ identifier: "GetExecutionRequest" });

export const GetExecutionResponse = ExecutionDetailsResponse.annotate({
  identifier: "GetExecutionResponse",
});

export const ListExecutionsRequest = Schema.Struct({
  cursor: Schema.optionalKey(ExecutionId),
  walletId: Schema.optionalKey(WalletId),
  sessionKeyId: Schema.optionalKey(SessionKeyId),
}).annotate({ identifier: "ListExecutionsRequest" });

export const ListExecutionsResponse = Schema.Struct({
  items: Schema.Array(ExecutionListItemResponse),
  nextCursor: Schema.NullOr(ExecutionId),
}).annotate({ identifier: "ListExecutionsResponse" });

export type ExecuteEvmRequest = typeof ExecuteEvmRequest.Type;
export type ExecuteRequest = typeof ExecuteRequest.Type;
export type ExecuteRequestHeaders = typeof ExecuteRequestHeaders.Type;
export type SimulateEvmExecutionRequest = typeof SimulateEvmExecutionRequest.Type;
export type SimulateExecutionRequest = typeof SimulateExecutionRequest.Type;
export type ExecutionSimulationPolicyDenial = typeof ExecutionSimulationPolicyDenial.Type;
export type AllowedExecutionSimulationResponse = typeof AllowedExecutionSimulationResponse.Type;
export type DeniedExecutionSimulationResponse = typeof DeniedExecutionSimulationResponse.Type;
export type SimulateExecutionResponse = typeof SimulateExecutionResponse.Type;
export type SubmittedEvmExecutionResponse = typeof SubmittedEvmExecutionResponse.Type;
export type ConfirmedEvmExecutionResponse = typeof ConfirmedEvmExecutionResponse.Type;
export type ExecuteResponse = typeof ExecuteResponse.Type;
export type EvmExecutionResponse = typeof EvmExecutionResponse.Type;
export type ExecutionResponse = typeof ExecutionResponse.Type;
export type ExecutionListDetailsResponse = typeof ExecutionListDetailsResponse.Type;
export type ExecutionListWalletResponse = typeof ExecutionListWalletResponse.Type;
export type ExecutionListSessionKeyResponse = typeof ExecutionListSessionKeyResponse.Type;
export type ExecutionListItemResponse = typeof ExecutionListItemResponse.Type;
export type ExecutionActorDetailsResponse = typeof ExecutionActorDetailsResponse.Type;
export type ExecutionDetailsResponse = typeof ExecutionDetailsResponse.Type;
export type GetExecutionSubmissionRequest = typeof GetExecutionSubmissionRequest.Type;
export type GetExecutionSubmissionResponse = typeof GetExecutionSubmissionResponse.Type;
export type GetExecutionRequest = typeof GetExecutionRequest.Type;
export type GetExecutionResponse = typeof GetExecutionResponse.Type;
export type ListExecutionsRequest = typeof ListExecutionsRequest.Type;
export type ListExecutionsResponse = typeof ListExecutionsResponse.Type;
