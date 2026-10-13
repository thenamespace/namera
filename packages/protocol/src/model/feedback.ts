import { Schema } from "effect";

import { OrganizationId, UserId } from "#/common/index";

export const FeedbackId = Schema.String.check(Schema.isUUID());
export const FeedbackCategory = Schema.Literals(["bug", "feature_request", "general"]);
export const FeedbackStatus = Schema.Literals([
  "new",
  "in_review",
  "planned",
  "completed",
  "closed",
]);
export type FeedbackStatus = typeof FeedbackStatus.Type;

export const FeedbackData = Schema.Struct({
  version: Schema.Literal(1),
  message: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(5000)),
});
export type FeedbackData = typeof FeedbackData.Type;

export const FeedbackPagePath = Schema.String.check(
  Schema.isMaxLength(500),
  Schema.isPattern(/^\/(?!\/)[^?#\s]*$/),
);

export const Feedback = Schema.Struct({
  id: FeedbackId,
  userId: UserId,
  organizationId: Schema.NullOr(OrganizationId),
  category: FeedbackCategory,
  data: FeedbackData,
  status: FeedbackStatus,
  pagePath: Schema.NullOr(FeedbackPagePath),
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});
export type Feedback = typeof Feedback.Type;
