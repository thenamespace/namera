import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";

import { Resend } from "resend";

import { EmailConfig } from "#/config";
import { EmailProviderId, EmailSendError, emailTemplates, type SendEmail } from "#/data";

export interface EmailServiceValue {
  readonly send: (input: SendEmail) => Effect.Effect<EmailProviderId, EmailSendError>;
}

const toMutableArray = <Value>(value: Value | ReadonlyArray<Value>): Array<Value> =>
  Array.isArray(value) ? [...value] : [value as Value];

export class EmailService extends Context.Service<EmailService, EmailServiceValue>()(
  "@namera-ai/emails/EmailService",
) {
  static readonly layer = Layer.effect(
    EmailService,
    Effect.gen(function* () {
      const config = yield* EmailConfig;
      const resend = new Resend(Redacted.value(config.apiKey));
      const configuredReplyTo = Option.getOrUndefined(config.replyTo);

      const send = Effect.fn("EmailService.send")(function* (input: SendEmail) {
        const template = emailTemplates[input.type];
        const response = yield* Effect.tryPromise({
          try: () =>
            resend.emails.send(
              {
                from: input.from ?? config.from,
                to: toMutableArray(input.to),
                template: {
                  id: template.id,
                  variables: input.variables,
                },
                ...(input.subject === undefined ? {} : { subject: input.subject }),
                ...(input.replyTo === undefined
                  ? configuredReplyTo === undefined
                    ? {}
                    : { replyTo: configuredReplyTo }
                  : { replyTo: toMutableArray(input.replyTo) }),
                ...(input.cc === undefined ? {} : { cc: toMutableArray(input.cc) }),
                ...(input.bcc === undefined ? {} : { bcc: toMutableArray(input.bcc) }),
                ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
              },
              input.idempotencyKey === undefined
                ? undefined
                : { idempotencyKey: input.idempotencyKey },
            ),
          catch: (cause) => new EmailSendError({ reason: "REQUEST_FAILED", cause }),
        });

        if (response.error !== null) {
          return yield* new EmailSendError({
            reason: "PROVIDER_REJECTED",
            cause: response.error,
          });
        }

        return yield* Schema.decodeUnknownEffect(EmailProviderId)(response.data.id).pipe(
          Effect.mapError((cause) => new EmailSendError({ reason: "INVALID_RESPONSE", cause })),
        );
      });

      return EmailService.of({ send });
    }),
  );
}
