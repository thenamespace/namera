import { Schema } from "effect";

export const GoogleAuthErrorCode = Schema.Literals([
  "GOOGLE_NOT_CONFIGURED",
  "GOOGLE_UNAVAILABLE",
  "GOOGLE_IDENTITY_INVALID",
  "GOOGLE_FLOW_INVALID",
  "GOOGLE_CANCELED",
  "GOOGLE_ACCOUNT_EXISTS",
  "GOOGLE_ALREADY_LINKED",
  "GOOGLE_ACCOUNT_NOT_FOUND",
  "REAUTHENTICATION_REQUIRED",
  "EMAIL_LOGIN_REQUIRED",
]);
export class GoogleAuthError extends Schema.TaggedError<GoogleAuthError>()(
  "GoogleAuthError",
  {
    code: GoogleAuthErrorCode,
  },
  { httpApiStatus: 400 },
) {}
