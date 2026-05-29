import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import { InternalError } from "@namera-ai/schema";

export const telemetryGroup = HttpApiGroup.make("telemetry")
  .add(
    HttpApiEndpoint.post("traces", "/traces", {
      error: [InternalError],
      success: HttpApiSchema.NoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("metrics", "/metrics", {
      error: [InternalError],
      success: HttpApiSchema.NoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("logs", "/logs", {
      error: [InternalError],
      success: HttpApiSchema.NoContent,
    }),
  )
  .prefix("/telemetry");
