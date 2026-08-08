import { Schema } from "effect";

import { ApplicationRelativePath, Email, VerificationId } from "#/common/index";

export const MagicLinkToken = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]+$/, {
    message: "Magic-link token must be base64url encoded",
  }),
  Schema.isMinLength(32, {
    message: "Magic-link token is too short",
  }),
  Schema.isMaxLength(128, {
    message: "Magic-link token is too long",
  }),
);

export const MagicLinkCode = Schema.String.check(
  Schema.isPattern(/^\d{8}$/, {
    message: "Magic-link code must contain exactly eight digits",
  }),
);

export const MagicLinkReturnTo = ApplicationRelativePath;

export const RequestMagicLinkRequest = Schema.Struct({
  email: Email,
  returnTo: Schema.optionalKey(MagicLinkReturnTo),
});

export const RequestMagicLinkResponse = Schema.Struct({
  message: Schema.Literal("If this email can sign in, we sent a sign-in email."),
});

export const GetMagicLinkRequest = Schema.Struct({
  id: VerificationId,
  token: MagicLinkToken,
});

export const VerifyMagicLinkRequest = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("token"),
    id: VerificationId,
    token: MagicLinkToken,
  }),
  Schema.Struct({
    type: Schema.Literal("code"),
    email: Email,
    code: MagicLinkCode,
  }),
]);

export const VerifyMagicLinkResponse = Schema.Void;

export type MagicLinkToken = typeof MagicLinkToken.Type;
export type MagicLinkCode = typeof MagicLinkCode.Type;
export type MagicLinkReturnTo = typeof MagicLinkReturnTo.Type;
export type RequestMagicLinkRequest = typeof RequestMagicLinkRequest.Type;
export type RequestMagicLinkResponse = typeof RequestMagicLinkResponse.Type;
export type GetMagicLinkRequest = typeof GetMagicLinkRequest.Type;
export type VerifyMagicLinkRequest = typeof VerifyMagicLinkRequest.Type;
export type VerifyMagicLinkResponse = typeof VerifyMagicLinkResponse.Type;
