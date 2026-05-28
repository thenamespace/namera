import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { InternalError, Unauthorized } from "@namera-ai/schema";
import { UpdateUserRequest, UpdateUserResponse } from "@namera-ai/schema/dto";

import { Authorization } from "../../middlewares";

export const userGroup = HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.post("update", "/update", {
      payload: UpdateUserRequest,
      success: UpdateUserResponse,
      error: [Unauthorized, InternalError],
    }),
  )

  .middleware(Authorization)
  .prefix("/auth/user");
