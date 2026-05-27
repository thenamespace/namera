import { DateTime, Effect, Layer, Redacted } from "effect";

import { Resend } from "resend";

import { EmailEnv } from "./config";
import { segmentIds, templates } from "./data";
import { EmailError, EmailLayer } from "./layer";

export const layer = Layer.effect(
  EmailLayer,
  Effect.gen(function* () {
    const env = yield* EmailEnv;
    const resend = new Resend(Redacted.value(env.resendApiKey));
    return EmailLayer.of({
      updateContactSegments: Effect.fn("updateContactSegments")(
        function* (opts) {
          const existingSegmentsRes = yield* Effect.tryPromise({
            try: () =>
              resend.contacts.segments.list({
                email: opts.email,
              }),
            catch: () =>
              new EmailError({ name: "Internal Error", message: "" }),
          });

          if (existingSegmentsRes.error) {
            return yield* new EmailError({
              name: existingSegmentsRes.error.name,
              message: existingSegmentsRes.error.message,
            });
          }

          const existing = new Set(
            existingSegmentsRes.data.data.map((s) => s.id),
          );
          const next = new Set(opts.segments.map((s) => segmentIds[s]!));

          const toAdd = [...next].filter((x) => !existing.has(x));
          const toRemove = [...existing].filter((x) => !next.has(x));

          yield* Effect.tryPromise({
            try: async () => {
              const promises = [
                ...toAdd.map((s) =>
                  resend.contacts.segments.add({
                    email: opts.email,
                    segmentId: s,
                  }),
                ),
                ...toRemove.map((s) =>
                  resend.contacts.segments.remove({
                    email: opts.email,
                    segmentId: s,
                  }),
                ),
              ];

              return await Promise.all(promises);
            },
            catch: () =>
              new EmailError({ name: "Internal Error", message: "" }),
          });
        },
      ),
      sendEmail: Effect.fn("")(function* (opts) {
        const { template, scheduledAt, ...rest } = opts;
        const res = yield* Effect.tryPromise({
          try: () =>
            resend.emails.send({
              ...rest,
              ...(scheduledAt
                ? { scheduledAt: DateTime.formatIsoDateUtc(scheduledAt) }
                : {}),
              template: {
                id: templates[template.type]!,
                variables: template.variables,
              },
            }),
          catch: () => new EmailError({ name: "Internal Error", message: "" }),
        });

        if (res.error) {
          return yield* new EmailError({
            name: res.error.name,
            message: res.error.message,
          });
        }
        return res.data.id;
      }),
      createContact: Effect.fn("")(function* (opts) {
        const res = yield* Effect.tryPromise({
          try: () => resend.contacts.create(opts),
          catch: () => new EmailError({ name: "Internal Error", message: "" }),
        });

        if (res.error) {
          return yield* new EmailError({
            name: res.error.name,
            message: res.error.message,
          });
        }
        return res.data.id;
      }),
    });
  }),
);
