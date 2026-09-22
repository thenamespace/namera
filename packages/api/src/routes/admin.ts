import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { ListUsersRequest, ListUsersResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { AdminAuthorization } from "#/middlewares/admin";

export class AdminUserGroup extends HttpApiGroup.make("adminUser")
  .add(
    HttpApiEndpoint.get("list", "/internal/users", {
      query: ListUsersRequest,
      success: ListUsersResponse,
      error: CommonErrors,
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
