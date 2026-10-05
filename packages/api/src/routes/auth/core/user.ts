import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { UpdateUserRequest, UpdateUserResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class UserGroup extends HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.post("update", "/update-user", {
      error: CommonErrors,
      payload: UpdateUserRequest,
      success: UpdateUserResponse,
    }).annotate(OpenApi.Summary, "Update the current user profile"),
  )
  .annotate(OpenApi.Description, "Authenticated user operations")
  .middleware(Authorization)
  .prefix("/auth/user") {}
