import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import {
  DatabaseError,
  Unauthorized,
  UpdateUserRequest,
  UpdateUserResponse,
} from "@namera-ai/schema";

export const userGroup = HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.post("update", "/update", {
      payload: UpdateUserRequest,
      success: UpdateUserResponse,
      error: [Unauthorized, DatabaseError],
    }),
  )

  .middleware(Authorization)
  .prefix("/auth/user");
