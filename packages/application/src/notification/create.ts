import { Effect, Metric } from "effect";

import { Repository } from "@namera-ai/database";
import { EmailJobs, type EnqueueEmailProps } from "@namera-ai/emails";
import type { UserId } from "@namera-ai/protocol";
import type { NotificationInsert } from "@namera-ai/protocol/model";
import { notificationRecipientsAdded, notificationsCreated } from "@namera-ai/telemetry";

import { notificationPolicy } from "./data.js";

type WithoutIdempotency<Input> = Input extends unknown ? Omit<Input, "idempotencyKey"> : never;

export interface NotificationRecipientInput {
  readonly userId: UserId;
  readonly email?: WithoutIdempotency<EnqueueEmailProps>;
}

export type CreateNotificationInput = NotificationInsert & {
  readonly recipients: ReadonlyArray<NotificationRecipientInput>;
};

export const makeCreateNotification = Effect.gen(function* () {
  const emailJobs = yield* EmailJobs;
  const repository = yield* Repository;

  return Effect.fn("application.notification.create")(function* (input: CreateNotificationInput) {
    const { recipients, ...notificationInput } = input;
    const created = yield* repository.notification.inbox.create(notificationInput);
    const policy = notificationPolicy[input.type];

    if (created.inserted) {
      yield* Metric.update(Metric.withAttributes(notificationsCreated, { type: input.type }), 1);
    }

    for (const recipient of recipients) {
      // Organization preferences override the user's global preference. Missing
      // rows fall back to the notification type's explicit email default, while
      // in-app delivery is always recorded for the selected recipient.
      const emailPreference =
        (input.organizationId === null
          ? undefined
          : yield* repository.notification.preference.findForScope({
              userId: recipient.userId,
              organizationId: input.organizationId,
              ...policy.target,
              channel: "email",
            })) ??
        (yield* repository.notification.preference.findForScope({
          userId: recipient.userId,
          organizationId: null,
          ...policy.target,
          channel: "email",
        }));
      const emailEnabled = emailPreference?.enabled ?? policy.emailDefaultEnabled;
      const emailJob =
        recipient.email === undefined || !emailEnabled
          ? undefined
          : yield* emailJobs.enqueue({
              ...recipient.email,
              idempotencyKey: `${input.idempotencyKey}:${recipient.userId}:email`,
            });
      const added = yield* repository.notification.inbox.addRecipient({
        notificationId: created.notification.id,
        userId: recipient.userId,
        ...(emailJob === undefined ? {} : { emailJobId: emailJob.id }),
      });
      if (added.inserted) {
        yield* Metric.update(
          Metric.withAttributes(notificationRecipientsAdded, { type: input.type }),
          1,
        );
      }
    }

    return created.notification;
  });
});
