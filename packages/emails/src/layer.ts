import { Context, Effect, Layer, Option, Redacted, Ref, Schema } from "effect";

import { EmailError } from "@namera-ai/protocol";
import type { EmailRecipient } from "@namera-ai/protocol/model";
import { Resend } from "resend";

import { EmailConfig } from "#/config";
import { EmailProviderId, emailPolicy, emailTemplates } from "#/data";
import { type SendEmailProps } from "#/types";

import { renderEmail } from "./templates/render.js";

const developmentEmailProviderId = Schema.decodeSync(EmailProviderId)("development");
const testEmailProviderId = Schema.decodeSync(EmailProviderId)("test");

const toProviderRecipients = (recipients: EmailRecipient): string | Array<string> =>
  typeof recipients === "string" ? recipients : [...recipients];

export interface EmailServiceValue {
  readonly send: (input: SendEmailProps) => Effect.Effect<EmailProviderId, EmailError>;
}

export class TestEmails extends Context.Service<
  TestEmails,
  {
    readonly capture: (input: SendEmailProps) => Effect.Effect<void>;
    readonly clear: Effect.Effect<void>;
    readonly failNext: (count?: number) => Effect.Effect<void>;
    readonly latest: Effect.Effect<SendEmailProps>;
    readonly sent: Effect.Effect<ReadonlyArray<SendEmailProps>>;
    readonly takeFailure: Effect.Effect<boolean>;
  }
>()("@namera-ai/emails/TestEmails") {
  static readonly layer = Layer.effect(
    TestEmails,
    Effect.gen(function* () {
      const messages = yield* Ref.make<ReadonlyArray<SendEmailProps>>([]);
      const failures = yield* Ref.make(0);

      return TestEmails.of({
        capture: (input) => Ref.update(messages, (sent) => [...sent, input]),
        clear: Effect.all([Ref.set(messages, []), Ref.set(failures, 0)]).pipe(Effect.asVoid),
        failNext: (count = 1) => Ref.set(failures, count),
        latest: Ref.get(messages).pipe(
          Effect.flatMap((sent) => {
            const latest = sent.at(-1);
            return latest === undefined
              ? Effect.die("Expected an email to have been sent")
              : Effect.succeed(latest);
          }),
        ),
        sent: Ref.get(messages),
        takeFailure: Ref.modify(failures, (remaining) => [
          remaining > 0,
          Math.max(0, remaining - 1),
        ]),
      });
    }),
  );
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

      const send = Effect.fn("emails.provider.send")(function* (input: SendEmailProps) {
        const template = emailTemplates[input.type];
        const response = yield* Effect.tryPromise({
          try: () =>
            resend.emails.send(
              {
                from: input.from ?? config.from,
                to: toProviderRecipients(input.to),
                react: renderEmail(input),
                subject: input.subject ?? template.subject,
                ...(input.replyTo === undefined
                  ? configuredReplyTo === undefined
                    ? {}
                    : { replyTo: configuredReplyTo }
                  : { replyTo: toProviderRecipients(input.replyTo) }),
                ...(input.cc === undefined ? {} : { cc: toProviderRecipients(input.cc) }),
                ...(input.bcc === undefined ? {} : { bcc: toProviderRecipients(input.bcc) }),
                ...(input.tags === undefined
                  ? {}
                  : { tags: input.tags.map((tag) => ({ ...tag })) }),
              },
              input.idempotencyKey === undefined
                ? undefined
                : { idempotencyKey: input.idempotencyKey },
            ),
          catch: (cause) => new EmailError({ reason: "REQUEST_FAILED", cause }),
        }).pipe(
          Effect.timeoutOrElse({
            duration: emailPolicy.requestTimeout,
            orElse: () =>
              Effect.fail(
                new EmailError({
                  reason: "REQUEST_FAILED",
                  cause: new Error("Email provider request timed out"),
                }),
              ),
          }),
        );

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

  static readonly devLayer = Layer.succeed(
    EmailService,
    EmailService.of({
      send: Effect.fn("emails.provider.development.send")(function* (input) {
        yield* Effect.logInfo("email.development.sent").pipe(
          Effect.annotateLogs({ type: input.type, variables: input.variables }),
        );

        return developmentEmailProviderId;
      }),
    }),
  );

  static readonly testLayer = Layer.effect(
    EmailService,
    Effect.gen(function* () {
      const emails = yield* TestEmails;

      return EmailService.of({
        send: Effect.fn("emails.provider.test.send")(function* (input) {
          const shouldFail = yield* emails.takeFailure;
          if (shouldFail) {
            return yield* new EmailError({
              reason: "REQUEST_FAILED",
              cause: new Error("Test email provider failure"),
            });
          }
          yield* emails.capture(input);
          return testEmailProviderId;
        }),
      });
    }),
  ).pipe(Layer.provideMerge(TestEmails.layer));
}
