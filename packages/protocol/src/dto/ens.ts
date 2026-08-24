import { Schema } from "effect";

import { EnsLabel } from "#/common/index";

export const EnsNameAvailabilityRequest = Schema.Struct({
  label: EnsLabel,
}).annotate({ identifier: "EnsNameAvailabilityRequest" });

export const EnsNameAvailabilityResponse = Schema.Struct({
  label: EnsLabel,
  name: Schema.String,
  available: Schema.Boolean,
}).annotate({ identifier: "EnsNameAvailabilityResponse" });

export type EnsNameAvailabilityRequest = typeof EnsNameAvailabilityRequest.Type;
export type EnsNameAvailabilityResponse = typeof EnsNameAvailabilityResponse.Type;
