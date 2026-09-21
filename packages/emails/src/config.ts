import { Config } from "effect";

export const emailConfig = {
  apiKey: Config.Redacted("RESEND_API_KEY"),
  from: Config.String("EMAIL_FROM"),
  replyTo: Config.option(Config.String("EMAIL_REPLY_TO")),
};

export const EmailConfig = Config.all(emailConfig);
export type EmailEnvValues = Config.Success<typeof EmailConfig>;
