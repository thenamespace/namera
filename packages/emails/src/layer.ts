import { Context, Effect, Schema } from "effect";

import { type CreateContactOptions } from "resend";

import type { SendEmailOpts, UpdateContactSegment } from "./types";

export class EmailError extends Schema.TaggedErrorClass<EmailError>()(
  "EmailError",
  {
    name: Schema.String,
    message: Schema.String,
  },
) {}

export type EmailLayer = {
  sendEmail: (opts: SendEmailOpts) => Effect.Effect<string, EmailError>;
  createContact: (
    opts: CreateContactOptions,
  ) => Effect.Effect<string, EmailError>;
  updateContactSegments: (
    opts: UpdateContactSegment,
  ) => Effect.Effect<void, EmailError>;
};

export const EmailLayer = Context.Service<EmailLayer>("EmailLayer");
