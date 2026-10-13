import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { FeedbackNotFoundError, PlatformAuthError } from "@namera-ai/protocol";
import {
  CreateFeedbackRequest,
  CreateFeedbackResponse,
  FeedbackView,
  ListFeedbackRequest,
  ListFeedbackResponse,
  UpdateFeedbackStatusRequest,
} from "@namera-ai/protocol/dto";
import { FeedbackId } from "@namera-ai/protocol/model";

import { CommonErrors } from "#/common";
import { AdminAuthorization, Authorization } from "#/middlewares/index";

export class FeedbackGroup extends HttpApiGroup.make("feedback")
  .add(
    HttpApiEndpoint.post("create", "/feedback", {
      payload: CreateFeedbackRequest,
      success: CreateFeedbackResponse,
      error: CommonErrors,
    }),
  )
  .middleware(Authorization)
  .annotate(OpenApi.Exclude, true) {}

export class AdminFeedbackGroup extends HttpApiGroup.make("adminFeedback")
  .add(
    HttpApiEndpoint.get("list", "/internal/feedback", {
      query: ListFeedbackRequest,
      success: ListFeedbackResponse,
      error: [...CommonErrors, PlatformAuthError],
    }),
    HttpApiEndpoint.get("get", "/internal/feedback/:id", {
      params: Schema.Struct({ id: FeedbackId }),
      success: FeedbackView,
      error: [...CommonErrors, PlatformAuthError, FeedbackNotFoundError],
    }),
    HttpApiEndpoint.patch("updateStatus", "/internal/feedback/:id/status", {
      params: Schema.Struct({ id: FeedbackId }),
      payload: UpdateFeedbackStatusRequest,
      success: FeedbackView,
      error: [...CommonErrors, PlatformAuthError, FeedbackNotFoundError],
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(OpenApi.Exclude, true) {}
