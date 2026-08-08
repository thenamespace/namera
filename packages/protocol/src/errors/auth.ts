import { Schema } from "effect";

export class MagicLinkError extends Schema.TaggedError<MagicLinkError>()("MagicLinkError", {
  code: Schema.Literals(["INVALID_OR_EXPIRED_LINK", "TOO_MANY_ATTEMPTS", "SIGN_IN_NOT_ALLOWED"]),
  message: Schema.optional(Schema.String),
}) {}

export class OrganizationError extends Schema.TaggedError<OrganizationError>()(
  "OrganizationError",
  {
    code: Schema.Literals([
      "ORGANIZATION_CREATE_FAILED",
      "ORGANIZATION_UPDATE_FAILED",
      "INSUFFICIENT_PERMISSIONS",
      "SLUG_ALREADY_TAKEN",
      "ORGANIZATION_CREATION_LIMIT_REACHED",
      "ORGANIZATION_NOT_FOUND",
      "ORGANIZATION_MEMBER_NOT_FOUND",
    ]),
    message: Schema.optional(Schema.String),
  },
) {}

export class InvitationError extends Schema.TaggedError<InvitationError>()("InvitationError", {
  code: Schema.Literals(["INVITATION_NOT_FOUND", "ALREADY_A_MEMBER", "INVITATION_EMAIL_MISMATCH"]),
  message: Schema.optional(Schema.String),
}) {}
