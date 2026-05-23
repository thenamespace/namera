import { Struct } from "effect";

import { UserPreference, UserPreferenceUpdate } from "@/core";

export const GetUserPreferenceResponse = UserPreference;

export const UpdateUserPreferenceRequest = UserPreferenceUpdate.mapFields(
  Struct.pick(["notificationPreferences", "metadata"]),
);
export const UpdateUserPreferenceResponse = UserPreference;

export type GetUserPreferenceResponse = typeof GetUserPreferenceResponse.Type;
export type UpdateUserPreferenceRequest =
  typeof UpdateUserPreferenceRequest.Type;
export type UpdateUserPreferenceResponse =
  typeof UpdateUserPreferenceResponse.Type;
