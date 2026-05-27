import { Config } from "effect";

export const EmailEnv = Config.all({
  resendApiKey: Config.redacted("RESEND_API_KEY"),
});

export type EmailEnv = Config.Success<typeof EmailEnv>;
