import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { JoinWaitlistRequest, JoinWaitlistResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";

export class WaitlistGroup extends HttpApiGroup.make("waitlist").add(
  HttpApiEndpoint.post("join", "/waitlist", {
    payload: JoinWaitlistRequest,
    success: JoinWaitlistResponse,
    error: CommonErrors,
  }),
) {}
