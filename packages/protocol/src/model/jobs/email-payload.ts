import { Schema, Struct } from "effect";

import { Email } from "#/common/index";
import { NonEmptyString } from "#/model/common";

export const EmailJobType = Schema.Literals([
  "platform-invitation",
  "connected-account-changed",
  "magic-link",
  "new-sign-in",
  "organization-invitation",
  "wallet-created",
  "session-key-created",
  "session-key-revoked",
  "api-key-created",
  "api-key-revoked",
]);

export const EmailRecipient = Schema.Union([
  Email,
  Schema.Array(Email).check(Schema.isMinLength(1)),
]);

export const EmailTag = Schema.Struct({
  name: NonEmptyString,
  value: NonEmptyString,
});

const EmailPayloadFields = Schema.Struct({
  to: EmailRecipient,
  from: Schema.optionalKey(NonEmptyString),
  subject: Schema.optionalKey(NonEmptyString),
  replyTo: Schema.optionalKey(EmailRecipient),
  cc: Schema.optionalKey(EmailRecipient),
  bcc: Schema.optionalKey(EmailRecipient),
  tags: Schema.optionalKey(Schema.Array(EmailTag)),
});

export const MagicLinkEmailVariables = Schema.Struct({
  magicLinkUrl: NonEmptyString,
  code: NonEmptyString,
  expiresInMinutes: Schema.Int.check(Schema.isGreaterThan(0)),
});

export const NewSignInEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  signedInAt: NonEmptyString,
  ipAddress: NonEmptyString,
  userAgent: NonEmptyString,
});

export const OrganizationInvitationEmailVariables = Schema.Struct({
  invitationUrl: NonEmptyString,
  organizationName: NonEmptyString,
  inviterName: NonEmptyString,
  roleName: NonEmptyString,
  expiresAt: NonEmptyString,
});

export const WalletCreatedEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  walletName: NonEmptyString,
  organizationName: NonEmptyString,
  address: NonEmptyString,
  addressUrl: NonEmptyString,
  implementation: Schema.Literal("alchemy-modular-v2"),
  ownership: NonEmptyString,
});

export const SessionKeyCreatedEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  sessionKeyName: NonEmptyString,
  walletName: NonEmptyString,
  organizationName: NonEmptyString,
  expiresAt: NonEmptyString,
});

export const SessionKeyRevokedEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  sessionKeyName: NonEmptyString,
  walletName: NonEmptyString,
  organizationName: NonEmptyString,
  revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const ApiKeyCreatedEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  apiKeyName: NonEmptyString,
  organizationName: NonEmptyString,
  sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});

export const ApiKeyRevokedEmailVariables = Schema.Struct({
  actionUrl: Schema.optionalKey(NonEmptyString),
  apiKeyName: NonEmptyString,
  organizationName: NonEmptyString,
  sessionKeyCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const EmailJobPayload = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("platform-invitation"),
    variables: Schema.Struct({
      invitationUrl: NonEmptyString,
      role: Schema.Literals(["operator", "viewer"]),
      expiresAt: NonEmptyString,
    }),
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("connected-account-changed"),
    variables: Schema.Struct({
      provider: Schema.Literal("Google"),
      action: Schema.Literals(["connected", "disconnected"]),
      changedAt: NonEmptyString,
    }),
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("magic-link"),
    variables: MagicLinkEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("new-sign-in"),
    variables: NewSignInEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("organization-invitation"),
    variables: OrganizationInvitationEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("wallet-created"),
    variables: WalletCreatedEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("session-key-created"),
    variables: SessionKeyCreatedEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("session-key-revoked"),
    variables: SessionKeyRevokedEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("api-key-created"),
    variables: ApiKeyCreatedEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
  Schema.Struct({
    type: Schema.Literal("api-key-revoked"),
    variables: ApiKeyRevokedEmailVariables,
  }).mapFields(Struct.assign(EmailPayloadFields.fields)),
]);

export type EmailJobType = typeof EmailJobType.Type;
export type EmailRecipient = typeof EmailRecipient.Type;
export type EmailTag = typeof EmailTag.Type;
export type MagicLinkEmailVariables = typeof MagicLinkEmailVariables.Type;
export type NewSignInEmailVariables = typeof NewSignInEmailVariables.Type;
export type OrganizationInvitationEmailVariables = typeof OrganizationInvitationEmailVariables.Type;
export type WalletCreatedEmailVariables = typeof WalletCreatedEmailVariables.Type;
export type SessionKeyCreatedEmailVariables = typeof SessionKeyCreatedEmailVariables.Type;
export type SessionKeyRevokedEmailVariables = typeof SessionKeyRevokedEmailVariables.Type;
export type ApiKeyCreatedEmailVariables = typeof ApiKeyCreatedEmailVariables.Type;
export type ApiKeyRevokedEmailVariables = typeof ApiKeyRevokedEmailVariables.Type;
export type EmailJobPayload = typeof EmailJobPayload.Type;
