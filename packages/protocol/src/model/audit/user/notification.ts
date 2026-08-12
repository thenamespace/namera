import { Schema } from "effect";

import { OrganizationId } from "#/common/index";
import {
  NotificationPreferenceChannel,
  withNotificationPreferenceTarget,
} from "#/model/notification/index";

export const NotificationPreferenceUpdatedEventDataV1 = Schema.Struct({
  event: Schema.Literal("notification.preference_updated"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    organizationId: Schema.NullOr(OrganizationId),
    category: Schema.Literals(["security", "organization", "wallet", "billing", "product"]),
    channel: Schema.Literals(["in-app", "email"]),
    enabled: Schema.NullOr(Schema.Boolean),
  }),
});

export const NotificationPreferenceUpdatedEventData = Schema.Struct({
  event: Schema.Literal("notification.preference_updated"),
  data: withNotificationPreferenceTarget({
    version: Schema.Literal(2),
    organizationId: Schema.NullOr(OrganizationId),
    channel: NotificationPreferenceChannel,
    enabled: Schema.NullOr(Schema.Boolean),
  }),
});
