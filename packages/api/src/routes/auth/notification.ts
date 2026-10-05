import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import {
  ListNotificationPreferencesResponse,
  ListNotificationsRequest,
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  NotificationMutationRequest,
  NotificationMutationResponse,
  ResetNotificationPreferenceRequest,
  ResetNotificationPreferenceResponse,
  UnreadNotificationCountResponse,
  UpdateNotificationPreferenceRequest,
  UpdateNotificationPreferenceResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class NotificationGroup extends HttpApiGroup.make("notification")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: ListNotificationsRequest,
      success: ListNotificationsResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List notifications"),
    HttpApiEndpoint.get("unreadCount", "/unread-count", {
      success: UnreadNotificationCountResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Get the unread notification count"),
    HttpApiEndpoint.post("markRead", "/mark-read", {
      payload: NotificationMutationRequest,
      success: NotificationMutationResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Mark a notification as read"),
    HttpApiEndpoint.post("markAllRead", "/mark-all-read", {
      success: MarkAllNotificationsReadResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Mark all notifications as read"),
    HttpApiEndpoint.post("archive", "/archive", {
      payload: NotificationMutationRequest,
      success: NotificationMutationResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Archive a notification"),
    HttpApiEndpoint.get("listPreferences", "/preferences", {
      success: ListNotificationPreferencesResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List notification preferences"),
    HttpApiEndpoint.post("updatePreference", "/preferences/update", {
      payload: UpdateNotificationPreferenceRequest,
      success: UpdateNotificationPreferenceResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Update a notification preference"),
    HttpApiEndpoint.post("resetPreference", "/preferences/reset", {
      payload: ResetNotificationPreferenceRequest,
      success: ResetNotificationPreferenceResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Reset a notification preference"),
  )
  .annotate(OpenApi.Description, "Authenticated notification inbox and preferences")
  .middleware(Authorization)
  .prefix("/auth/notification") {}
