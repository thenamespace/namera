import { Effect } from "effect";

import { makeNotificationInboxApplication, type NotificationInboxApplication } from "./inbox.js";
import {
  makeNotificationPreferenceApplication,
  type NotificationPreferenceApplication,
} from "./preference.js";

export type NotificationApplication = NotificationInboxApplication &
  NotificationPreferenceApplication;

export const makeNotificationApplication = Effect.gen(function* () {
  const inbox = yield* makeNotificationInboxApplication;
  const preference = yield* makeNotificationPreferenceApplication;
  return { ...inbox, ...preference } satisfies NotificationApplication;
});
