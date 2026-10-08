import { Schema } from "effect";

export class PlatformAuthError extends Schema.TaggedError<PlatformAuthError>()(
  "PlatformAuthError",
  {
    code: Schema.Literals([
      "ADMIN_ACCESS_REQUIRED",
      "RECENT_LOGIN_REQUIRED",
      "MEMBER_NOT_FOUND",
      "MEMBER_ALREADY_EXISTS",
      "OWNER_TRANSFER_REQUIRED",
      "INVITATION_UNAVAILABLE",
      "INVITATION_EMAIL_MISMATCH",
      "OWNER_ALREADY_EXISTS",
      "VERIFIED_USER_REQUIRED",
      "ADMIN_ORIGIN_REQUIRED",
    ]),
  },
  { httpApiStatus: 403 },
) {}
