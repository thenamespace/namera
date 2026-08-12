import { Context, Effect, Layer, Option, Redacted, Ref, Schema } from "effect";

import { EmailError } from "@namera-ai/protocol";
import { Resend } from "resend";

import { EmailConfig } from "#/config";
import { EmailProviderId, emailPolicy, emailTemplates } from "#/data";
import { type SendEmailProps } from "#/types";

const developmentEmailProviderId = Schema.decodeSync(EmailProviderId)("development");
const testEmailProviderId = Schema.decodeSync(EmailProviderId)("test");

export interface EmailServiceValue {
  readonly send: (input: SendEmailProps) => Effect.Effect<EmailProviderId, EmailError>;
}

export class TestEmails extends Context.Service<
  TestEmails,
  {
    readonly capture: (input: SendEmailProps) => Effect.Effect<void>;
    readonly clear: Effect.Effect<void>;
    readonly latest: Effect.Effect<SendEmailProps>;
    readonly sent: Effect.Effect<ReadonlyArray<SendEmailProps>>;
  }
>()("@namera-ai/emails/TestEmails") {
  static readonly layer = Layer.effect(
    TestEmails,
    Effect.gen(function* () {
      const messages = yield* Ref.make<ReadonlyArray<SendEmailProps>>([]);

      return TestEmails.of({
        capture: (input) => Ref.update(messages, (sent) => [...sent, input]),
        clear: Ref.set(messages, []),
        latest: Ref.get(messages).pipe(
          Effect.flatMap((sent) => {
            const latest = sent.at(-1);
            return latest === undefined
              ? Effect.die("Expected an email to have been sent")
              : Effect.succeed(latest);
          }),
        ),
        sent: Ref.get(messages),
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

  static readonly developmentLayer = Layer.succeed(
    EmailService,
    EmailService.of({
      send: Effect.fn("EmailService.development.send")(function* (input) {
        yield* Effect.logInfo("email.development.sent", {
          type: input.type,
          variables: input.variables,
        });

        return developmentEmailProviderId;
      }),
    }),
  );

  static readonly testLayer = Layer.effect(
    EmailService,
    Effect.gen(function* () {
      const emails = yield* TestEmails;

      return EmailService.of({
        send: Effect.fn("EmailService.test.send")(function* (input) {
          yield* emails.capture(input);
          return testEmailProviderId;
        }),
      });
    }),
  ).pipe(Layer.provideMerge(TestEmails.layer));
}
