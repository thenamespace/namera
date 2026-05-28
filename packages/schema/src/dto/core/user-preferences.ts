import { Struct } from "effect";

import { UserPreference, UserPreferenceUpdate } from "../../database";

export const GetUserPreferencesResponse = UserPreference.mapFields(
  Struct.pick(["id", "metadata", "notificationPreferences"]),
);

export const UpdateUserPreferencesRequest = UserPreferenceUpdate.mapFields(
  Struct.pick(["metadata", "notificationPreferences"]),
);
export const UpdateUserPreferencesResponse = GetUserPreferencesResponse;

export type GetUserPreferencesResponse = typeof GetUserPreferencesResponse.Type;
export type UpdateUserPreferencesRequest =
  typeof UpdateUserPreferencesRequest.Type;
export type UpdateUserPreferencesResponse =
  typeof UpdateUserPreferencesResponse.Type;
