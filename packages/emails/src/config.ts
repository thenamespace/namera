import { Config } from "effect";

export const emailConfig = {
  apiKey: Config.redacted("RESEND_API_KEY"),
  from: Config.string("EMAIL_FROM"),
  replyTo: Config.option(Config.string("EMAIL_REPLY_TO")),
};

export const EmailConfig = Config.all(emailConfig);
export type EmailEnvValues = Config.Success<typeof EmailConfig>;
