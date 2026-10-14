import { Schema } from "effect";

// Internal provider-neutral lifecycle error, translated by the owning creation flow.
export class SignerProvisioningError extends Schema.TaggedError<SignerProvisioningError>()(
  "SignerProvisioningError",
  { code: Schema.Literals(["REQUEST_CONFLICT", "RECOVERY_REQUIRED", "LEASE_LOST"]) },
) {}
