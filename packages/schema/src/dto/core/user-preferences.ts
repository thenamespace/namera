import { Struct } from "effect";

import { UserPreference } from "@/database";

export const GetUserPreferencesResponse = UserPreference.mapFields(
  Struct.pick(["id", "metadata", "notificationPreferences"]),
);

export const UpdateUserPreferencesRequest = UserPreference.mapFields(
  Struct.pick(["metadata", "notificationPreferences"]),
);
export const UpdateUserPreferencesResponse = GetUserPreferencesResponse;
