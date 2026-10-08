import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { PlatformAuthError } from "@namera-ai/protocol";
import {
  AcceptWaitlistResponse,
  ListWaitlistRequest,
  ListWaitlistResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

export class AdminWaitlistGroup extends HttpApiGroup.make("adminWaitlist")
  .add(
    HttpApiEndpoint.get("list", "/internal/waitlist", {
      query: ListWaitlistRequest,
      success: ListWaitlistResponse,
      error: [...CommonErrors, PlatformAuthError],
    }),
    HttpApiEndpoint.post("accept", "/internal/waitlist/:id/accept", {
      params: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
      success: AcceptWaitlistResponse,
      error: [...CommonErrors, PlatformAuthError],
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
