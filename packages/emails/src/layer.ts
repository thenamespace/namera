import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";

import { EmailError } from "@namera-ai/protocol";
import { Resend } from "resend";

import { EmailConfig } from "#/config";
import { EmailProviderId, emailTemplates } from "#/data";
import { type SendEmailProps } from "#/types";

const developmentEmailProviderId = Schema.decodeSync(EmailProviderId)("development");

export interface EmailServiceValue {
  readonly send: (input: SendEmailProps) => Effect.Effect<EmailProviderId, EmailError>;
}

export class EmailService extends Context.Service<EmailService, EmailServiceValue>()(
  "@namera-ai/emails/EmailService",
) {
  static readonly layer = Layer.effect(
    EmailService,
    Effect.gen(function* () {
      const config = yield* EmailConfig;
      const resend = new Resend(Redacted.value(config.apiKey));
      const configuredReplyTo = Option.getOrUndefined(config.replyTo);

      const send = Effect.fn("EmailService.send")(function* (input: SendEmailProps) {
        const template = emailTemplates[input.type];
        const response = yield* Effect.tryPromise({
          try: () =>
            resend.emails.send(
              {
                from: input.from ?? config.from,
                to: input.to,
                template: {
                  id: template.id,
                  variables: input.variables,
                },
                ...(input.subject === undefined ? {} : { subject: input.subject }),
                ...(input.replyTo === undefined
                  ? configuredReplyTo === undefined
                    ? {}
                    : { replyTo: configuredReplyTo }
                  : { replyTo: input.replyTo }),
                ...(input.cc === undefined ? {} : { cc: input.cc }),
                ...(input.bcc === undefined ? {} : { bcc: input.bcc }),
                ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
              },
              input.idempotencyKey === undefined
                ? undefined
                : { idempotencyKey: input.idempotencyKey },
            ),
          catch: (cause) => new EmailError({ reason: "REQUEST_FAILED", cause }),
        });

        if (response.error !== null) {
          return yield* new EmailError({
            reason: "PROVIDER_REJECTED",
            cause: response.error,
          });
        }

        return yield* Schema.decodeUnknownEffect(EmailProviderId)(response.data.id).pipe(
          Effect.mapError((cause) => new EmailError({ reason: "INVALID_RESPONSE", cause })),
        );
      });

      return EmailService.of({ send });
    }),
  );

  static readonly developmentLayer = Layer.succeed(
    EmailService,
    EmailService.of({
      send: () => Effect.succeed(developmentEmailProviderId),
    }),
  );
}
