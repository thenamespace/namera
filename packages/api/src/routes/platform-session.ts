import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { CommonErrors } from "#/common";
import { PlatformSessionAuthorization } from "#/middlewares/admin";

export class PlatformSessionGroup extends HttpApiGroup.make("platformSession")
  .add(
    HttpApiEndpoint.delete("logout", "/auth/platform/logout", {
      success: Schema.Void,
      error: CommonErrors,
    }),
  )
  .middleware(PlatformSessionAuthorization)
  .annotate(OpenApi.Exclude, true) {}
