import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

const HealthResponse = Schema.Struct({
  status: Schema.Boolean,
}).annotate({ identifier: "HealthResponse" });

export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health", {
    success: HealthResponse,
  }).annotate(OpenApi.Summary, "Check service health"),
) {}
