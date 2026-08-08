import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { UpdateUserRequest, UpdateUserResponse } from "@namera-ai/protocol/dto";

import { Authorization } from "#/middlewares/index";

export class UserGroup extends HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.post("update", "/update-user", {
      payload: UpdateUserRequest,
      success: UpdateUserResponse,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/user") {}
