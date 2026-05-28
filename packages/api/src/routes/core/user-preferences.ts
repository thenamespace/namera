import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import { InternalError, Unauthorized } from "@namera-ai/schema";
import {
  GetUserPreferencesResponse,
  UpdateUserPreferencesRequest,
  UpdateUserPreferencesResponse,
} from "@namera-ai/schema/dto";

export const userPreferencesGroup = HttpApiGroup.make("userPreferences")
  .add(
    HttpApiEndpoint.get("get", "/get", {
      success: GetUserPreferencesResponse,
      error: [Unauthorized, InternalError],
    }),
    HttpApiEndpoint.post("update", "/update", {
      payload: UpdateUserPreferencesRequest,
      success: UpdateUserPreferencesResponse,
      error: [Unauthorized, InternalError],
    }),
  )

  .middleware(Authorization)
  .prefix("/user-preferences");
