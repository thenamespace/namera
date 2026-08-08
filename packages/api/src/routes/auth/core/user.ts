import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { UpdateUserRequest, UpdateUserResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class UserGroup extends HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.post("update", "/update-user", {
      error: CommonErrors,
      payload: UpdateUserRequest,
      success: UpdateUserResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/user") {}
