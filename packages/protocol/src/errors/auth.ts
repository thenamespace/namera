import { Schema } from "effect";

export class InvalidMagicLinkError extends Schema.TaggedError<InvalidMagicLinkError>()(
  "MagicLinkError",
  {
    code: Schema.Literal("INVALID_OR_EXPIRED_LINK"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 400 },
) {}

export class MagicLinkAttemptsExceededError extends Schema.TaggedError<MagicLinkAttemptsExceededError>()(
  "MagicLinkError",
  {
    code: Schema.Literal("TOO_MANY_ATTEMPTS"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 429 },
) {}

export class BetaInviteRequiredError extends Schema.TaggedError<BetaInviteRequiredError>()(
  "BetaInviteError",
  {
    code: Schema.Literal("INVITE_REQUIRED_OR_UNAVAILABLE"),
  },
  { httpApiStatus: 403 },
) {}

export const MagicLinkErrors = [
  InvalidMagicLinkError,
  MagicLinkAttemptsExceededError,
  BetaInviteRequiredError,
] as const;
export const MagicLinkError = Schema.Union(MagicLinkErrors);
export type MagicLinkError = typeof MagicLinkError.Type;

export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  "OrganizationError",
  {
    code: Schema.Literal("ORGANIZATION_NOT_FOUND"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 404 },
) {}

export class OrganizationPermissionError extends Schema.TaggedError<OrganizationPermissionError>()(
  "OrganizationError",
  {
    code: Schema.Literal("INSUFFICIENT_PERMISSIONS"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 403 },
) {}

export const OrganizationErrors = [OrganizationNotFoundError, OrganizationPermissionError] as const;
export const OrganizationError = Schema.Union(OrganizationErrors);
export type OrganizationError = typeof OrganizationError.Type;

export class OrganizationMemberNotFoundError extends Schema.TaggedError<OrganizationMemberNotFoundError>()(
  "OrganizationMemberError",
  {
    code: Schema.Literal("ORGANIZATION_MEMBER_NOT_FOUND"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 404 },
) {}

export const OrganizationMemberErrors = [OrganizationMemberNotFoundError] as const;
export const OrganizationMemberError = Schema.Union(OrganizationMemberErrors);
export type OrganizationMemberError = typeof OrganizationMemberError.Type;

export class InvitationNotFoundError extends Schema.TaggedError<InvitationNotFoundError>()(
  "InvitationError",
  {
    code: Schema.Literal("INVITATION_NOT_FOUND"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 404 },
) {}

export class InvitationConflictError extends Schema.TaggedError<InvitationConflictError>()(
  "InvitationError",
  {
    code: Schema.Literal("ALREADY_A_MEMBER"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 409 },
) {}

export class InvitationRecipientMismatchError extends Schema.TaggedError<InvitationRecipientMismatchError>()(
  "InvitationError",
  {
    code: Schema.Literal("INVITATION_RECIPIENT_MISMATCH"),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 403 },
) {}

export const InvitationErrors = [
  InvitationNotFoundError,
  InvitationConflictError,
  InvitationRecipientMismatchError,
] as const;
export const InvitationError = Schema.Union(InvitationErrors);
export type InvitationError = typeof InvitationError.Type;

export class ApiKeyNotFoundError extends Schema.TaggedError<ApiKeyNotFoundError>()(
  "ApiKeyError",
  {
    code: Schema.Literal("API_KEY_NOT_FOUND"),
  },
  { httpApiStatus: 404 },
) {}

export class ApiKeyCreationError extends Schema.TaggedError<ApiKeyCreationError>()(
  "ApiKeyCreationError",
  {
    code: Schema.Literal("SESSION_KEY_NOT_ACTIVE"),
  },
  { httpApiStatus: 409 },
) {}

export const ApiKeyErrors = [ApiKeyNotFoundError, ApiKeyCreationError] as const;
export const ApiKeyError = Schema.Union(ApiKeyErrors);
export type ApiKeyError = typeof ApiKeyError.Type;
