import { Schema } from "effect";

import { Email } from "#/common/index";
import { UserMetadata } from "#/model/auth/core/user";
import { OrganizationMetadata } from "#/model/auth/organization/organization";
import {
  Feedback,
  FeedbackCategory,
  FeedbackData,
  FeedbackId,
  FeedbackPagePath,
  FeedbackStatus,
} from "#/model/feedback";

export const CreateFeedbackRequest = Schema.Struct({
  category: FeedbackCategory,
  data: FeedbackData,
  pagePath: Schema.optionalKey(FeedbackPagePath),
});
export type CreateFeedbackRequest = typeof CreateFeedbackRequest.Type;
export const CreateFeedbackResponse = Schema.Struct({ id: FeedbackId });

export const FeedbackView = Schema.Struct({
  ...Feedback.fields,
  user: Schema.Struct({ email: Email, metadata: UserMetadata }),
  organization: Schema.NullOr(Schema.Struct({ metadata: OrganizationMetadata })),
});
export type FeedbackView = typeof FeedbackView.Type;

export const ListFeedbackRequest = Schema.Struct({
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
  ),
  cursor: Schema.optionalKey(FeedbackId),
  status: Schema.optionalKey(FeedbackStatus),
  category: Schema.optionalKey(FeedbackCategory),
});
export type ListFeedbackRequest = typeof ListFeedbackRequest.Type;
export const ListFeedbackResponse = Schema.Struct({
  entries: Schema.Array(FeedbackView),
  nextCursor: Schema.NullOr(FeedbackId),
});
export const UpdateFeedbackStatusRequest = Schema.Struct({ status: FeedbackStatus });
