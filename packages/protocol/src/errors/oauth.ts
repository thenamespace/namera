import { Schema } from "effect";

export class OAuthAuthorizationRequestError extends Schema.TaggedError<OAuthAuthorizationRequestError>()(
  "OAuthAuthorizationRequestError",
  {
    code: Schema.Literals([
      "INVALID_CLIENT",
      "INVALID_REDIRECT_URI",
      "INVALID_REQUEST",
      "INVALID_RESOURCE",
      "INVALID_SCOPE",
      "REQUEST_NOT_FOUND",
      "UNSUPPORTED_RESPONSE_TYPE",
    ]),
  },
  { httpApiStatus: 400 },
) {}

export class OAuthTokenError extends Schema.TaggedError<OAuthTokenError>()("OAuthTokenError", {
  code: Schema.Literals([
    "INVALID_CLIENT",
    "INVALID_GRANT",
    "INVALID_REQUEST",
    "INVALID_SCOPE",
    "UNSUPPORTED_GRANT_TYPE",
  ]),
}) {}

export class McpAuthorizationError extends Schema.TaggedError<McpAuthorizationError>()(
  "McpAuthorizationError",
  {
    code: Schema.Literals([
      "AUTHORIZATION_NOT_FOUND",
      "AUTHORIZATION_NOT_ACTIVE",
      "SESSION_KEY_NOT_ACTIVE",
      "SESSION_KEY_NOT_FOUND",
    ]),
  },
  { httpApiStatus: 404 },
) {}
