import { Schema } from "effect";

// Internal workflow failure. Do not attach vendor responses or credentials.
export class ProviderConnectionError extends Schema.TaggedError<ProviderConnectionError>()(
  "ProviderConnectionError",
  {
    code: Schema.Literals([
      "LINK_REQUIRED",
      "RECOVERY_AMBIGUOUS",
      "CONNECTION_REVOKED",
      "AUTHORITY_EXPIRED",
      "IDENTITY_MISMATCH",
      "PROVISIONING_INCOMPLETE",
    ]),
  },
) {}
