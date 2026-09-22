import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { WaitlistNotFoundError } from "@namera-ai/protocol";
import {
  JoinWaitlistRequest,
  JoinWaitlistResponse,
  ListWaitlistRequest,
  ListWaitlistResponse,
  UpdateWaitlistRequest,
  WaitlistEntryResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

export class WaitlistGroup extends HttpApiGroup.make("waitlist").add(
  HttpApiEndpoint.post("join", "/waitlist", {
    payload: JoinWaitlistRequest,
    success: JoinWaitlistResponse,
    error: CommonErrors,
  }),
) {}

export class AdminWaitlistGroup extends HttpApiGroup.make("adminWaitlist")
  .add(
    HttpApiEndpoint.get("list", "/internal/waitlist", {
      query: ListWaitlistRequest,
      success: ListWaitlistResponse,
      error: CommonErrors,
    }),
    HttpApiEndpoint.patch("setStatus", "/internal/waitlist/:id", {
      params: { id: Schema.String.check(Schema.isUUID()) },
      payload: UpdateWaitlistRequest,
      success: WaitlistEntryResponse,
      error: [WaitlistNotFoundError, ...CommonErrors],
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
