import type { DateTime } from "effect";

import { Email } from "@namera-ai/schema";

import type { NameraSegmentId } from "../data";

export type EmailTemplate = {
  type: "sign-in-with-magic-link";
  variables: {};
};

export type EmailTemplateType = EmailTemplate["type"];

export type SendEmailOpts = {
  from: Email;
  to: Email | Email[];
  subject: string;
  bcc?: Email | Email[];
  cc?: Email | Email[];
  replyTo?: Email | Email[];
  scheduledAt: DateTime.Utc;
  tags?: { name: string; value: string }[];
  template: EmailTemplate;
};

export type CreateContactOpts = {
  email: Email;
  firstName?: string;
  lastName?: string;
  segments?: [];
};

export type UpdateContactSegment = {
  email: Email;
  segments: NameraSegmentId[];
};
