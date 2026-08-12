import { Schema } from "effect";

import { OrganizationId } from "#/common/index";
import { NotificationCategory, NotificationChannel } from "#/model/notification/index";

export const NotificationPreferenceUpdatedEventData = Schema.Struct({
  event: Schema.Literal("notification.preference_updated"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    organizationId: Schema.NullOr(OrganizationId),
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: Schema.NullOr(Schema.Boolean),
  }),
});
