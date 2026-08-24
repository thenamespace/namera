import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { EnsUnavailableError } from "@namera-ai/protocol";
import { EnsNameAvailabilityRequest, EnsNameAvailabilityResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";

export class EnsGroup extends HttpApiGroup.make("ens")
  .add(
    HttpApiEndpoint.get("isNameAvailable", "/availability", {
      query: EnsNameAvailabilityRequest,
      success: EnsNameAvailabilityResponse,
      error: [EnsUnavailableError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Check whether a Namera ENS label is available"),
  )
  .annotate(OpenApi.Description, "Public ENS name availability")
  .prefix("/ens") {}
