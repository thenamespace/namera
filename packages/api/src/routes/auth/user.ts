import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import { InternalError, Unauthorized } from "@namera-ai/schema";
import { UpdateUserRequest, UpdateUserResponse } from "@namera-ai/schema/dto";

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
