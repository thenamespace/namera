import { Schema } from "effect";

import {
  ApiKeyId,
  ExecutionId,
  InvitationId,
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
const ApiKeyCreatedNotificationType = Schema.Literal("api_key.created");
const ExecutionConfirmedNotificationType = Schema.Literal("execution.confirmed");

export const NotificationType = Schema.Union([
  NewSignInNotificationType,
  InvitationReceivedNotificationType,
  WalletCreatedNotificationType,
  SessionKeyCreatedNotificationType,
  ApiKeyCreatedNotificationType,
  ExecutionConfirmedNotificationType,
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
    policyTypes: Schema.Array(Schema.Literals(["evm.native-spend-limit", "evm.time-window"])),
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

export const NotificationPayload = Schema.Union([
  NewSignInNotificationPayload,
  InvitationReceivedNotificationPayload,
  WalletCreatedNotificationPayload,
  SessionKeyCreatedNotificationPayload,
  ApiKeyCreatedNotificationPayload,
  ExecutionConfirmedNotificationPayload,
]);

export type NotificationPayload = typeof NotificationPayload.Type;
export type NotificationPayloadEncoded = typeof NotificationPayload.Encoded;
export type NotificationType = typeof NotificationType.Type;
