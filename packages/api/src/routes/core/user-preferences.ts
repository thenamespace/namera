import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import {
  DatabaseError,
  GetUserPreferenceResponse,
  Unauthorized,
  UpdateUserPreferenceRequest,
  UpdateUserPreferenceResponse,
} from "@namera-ai/schema";

export const userPreferencesGroup = HttpApiGroup.make("userPreferences")
  .add(
    HttpApiEndpoint.get("get", "/get", {
      success: GetUserPreferenceResponse,
      error: [Unauthorized, DatabaseError],
    }),
    HttpApiEndpoint.post("update", "/update", {
      payload: UpdateUserPreferenceRequest,
      success: UpdateUserPreferenceResponse,
      error: [Unauthorized, DatabaseError],
    }),
  )

  .middleware(Authorization)
  .prefix("/user-preferences");
