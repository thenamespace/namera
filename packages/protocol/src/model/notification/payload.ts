import { Schema } from "effect";

import {
  ApiKeyId,
  ExecutionId,
  InvitationId,
  OAuthAuthorizationId,
  SessionId,
  SessionKeyId,
  WalletId,
} from "#/common/index";
import { EthereumAddress, SupportedEvmChainId, TransactionHash } from "#/evm/index";
import { WalletKeyProtectionLevel } from "#/model/core/wallet-key";

const NewSignInNotificationType = Schema.Literal("auth.new-sign-in");
const InvitationReceivedNotificationType = Schema.Literal("organization.invitation.received");
const WalletCreatedNotificationType = Schema.Literal("wallet.created");
const SessionKeyCreatedNotificationType = Schema.Literal("session_key.created");
const SessionKeyRevokedNotificationType = Schema.Literal("session_key.revoked");
const ApiKeyCreatedNotificationType = Schema.Literal("api_key.created");
const ApiKeyRevokedNotificationType = Schema.Literal("api_key.revoked");
const ExecutionConfirmedNotificationType = Schema.Literal("execution.confirmed");
const McpAuthorizationApprovedNotificationType = Schema.Literal("mcp_authorization.approved");
const McpAuthorizationRevokedNotificationType = Schema.Literal("mcp_authorization.revoked");
const CliAuthorizationApprovedNotificationType = Schema.Literal("cli_authorization.approved");
const CliAuthorizationRevokedNotificationType = Schema.Literal("cli_authorization.revoked");

export const NotificationType = Schema.Union([
  NewSignInNotificationType,
  InvitationReceivedNotificationType,
  WalletCreatedNotificationType,
  SessionKeyCreatedNotificationType,
  SessionKeyRevokedNotificationType,
  ApiKeyCreatedNotificationType,
  ApiKeyRevokedNotificationType,
  ExecutionConfirmedNotificationType,
  McpAuthorizationApprovedNotificationType,
  McpAuthorizationRevokedNotificationType,
  CliAuthorizationApprovedNotificationType,
  CliAuthorizationRevokedNotificationType,
]);

export const NewSignInNotificationPayload = Schema.Struct({
  type: NewSignInNotificationType,
  resourceType: Schema.Literal("session"),
  resourceId: SessionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    ipAddress: Schema.NullOr(Schema.String),
    userAgent: Schema.NullOr(Schema.String),
  }),
});

export const InvitationReceivedNotificationPayload = Schema.Struct({
  type: InvitationReceivedNotificationType,
  resourceType: Schema.Literal("invitation"),
  resourceId: InvitationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const WalletCreatedNotificationPayload = Schema.Struct({
  type: WalletCreatedNotificationType,
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    address: EthereumAddress,
    implementation: Schema.Literals(["kernel", "safe"]),
    protectionLevel: WalletKeyProtectionLevel,
  }),
});

export const SessionKeyCreatedNotificationPayload = Schema.Struct({
  type: SessionKeyCreatedNotificationType,
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    policyTypes: Schema.Array(
      Schema.Literals(["evm.native-spend-limit", "evm.signature", "evm.time-window"]),
    ),
  }),
});

export const SessionKeyRevokedNotificationPayload = Schema.Struct({
  type: SessionKeyRevokedNotificationType,
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});

export const ApiKeyCreatedNotificationPayload = Schema.Struct({
  type: ApiKeyCreatedNotificationType,
  resourceType: Schema.Literal("api-key"),
  resourceId: ApiKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
});

export const ApiKeyRevokedNotificationPayload = Schema.Struct({
  type: ApiKeyRevokedNotificationType,
  resourceType: Schema.Literal("api-key"),
  resourceId: ApiKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});

export const ExecutionConfirmedNotificationPayload = Schema.Struct({
  type: ExecutionConfirmedNotificationType,
  resourceType: Schema.Literal("execution"),
  resourceId: ExecutionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    transactionHash: TransactionHash,
  }),
});

export const McpAuthorizationApprovedNotificationPayload = Schema.Struct({
  type: McpAuthorizationApprovedNotificationType,
  resourceType: Schema.Literal("mcp-authorization"),
  resourceId: OAuthAuthorizationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientName: Schema.NonEmptyString,
    sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
});

export const McpAuthorizationRevokedNotificationPayload = Schema.Struct({
  type: McpAuthorizationRevokedNotificationType,
  resourceType: Schema.Literal("mcp-authorization"),
  resourceId: OAuthAuthorizationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientName: Schema.NonEmptyString,
    revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});

export const CliAuthorizationApprovedNotificationPayload = Schema.Struct({
  type: CliAuthorizationApprovedNotificationType,
  resourceType: Schema.Literal("cli-authorization"),
  resourceId: OAuthAuthorizationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    deviceName: Schema.NonEmptyString,
    sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
});

export const CliAuthorizationRevokedNotificationPayload = Schema.Struct({
  type: CliAuthorizationRevokedNotificationType,
  resourceType: Schema.Literal("cli-authorization"),
  resourceId: OAuthAuthorizationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    deviceName: Schema.NonEmptyString,
    revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});

export const NotificationPayload = Schema.Union([
  NewSignInNotificationPayload,
  InvitationReceivedNotificationPayload,
  WalletCreatedNotificationPayload,
  SessionKeyCreatedNotificationPayload,
  SessionKeyRevokedNotificationPayload,
  ApiKeyCreatedNotificationPayload,
  ApiKeyRevokedNotificationPayload,
  ExecutionConfirmedNotificationPayload,
  McpAuthorizationApprovedNotificationPayload,
  McpAuthorizationRevokedNotificationPayload,
  CliAuthorizationApprovedNotificationPayload,
  CliAuthorizationRevokedNotificationPayload,
]);

export type NotificationPayload = typeof NotificationPayload.Type;
export type NotificationPayloadEncoded = typeof NotificationPayload.Encoded;
export type NotificationType = typeof NotificationType.Type;
