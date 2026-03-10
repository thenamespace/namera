import { Config, Context, Duration, Effect, Layer } from "effect";

export const AuthEnvConfig = Config.all({
  baseURL: Config.url("AUTH_BASE_URL"),
  isProd: Config.boolean("IS_PROD"), // TODO: Change this to something global
});

export type AuthEnvValues = Config.Config.Success<typeof AuthEnvConfig>;
export type AuthConfigShape = AuthEnvValues & {
  trustedOrigins: string[];
  emailVerification: {
    expiresIn: Duration.Duration;
  };
  session: {
    cookieName: string;
    expiresIn: Duration.Duration;
    secure: boolean;
    domain?: string;
  };
  advanced: {
    ipAddress: {
      ipAddressHeaders: string[];
      disableIpTracking: boolean;
    };
  };
};

export class AuthConfig extends Context.Tag("AuthConfig")<
  AuthConfig,
  AuthConfigShape
>() {}

export const AuthConfigLive = Layer.effect(
  AuthConfig,
  Effect.gen(function* () {
    const env = yield* AuthEnvConfig;
    const isProd = env.isProd;

    const trustedOrigins = (() => {
      if (isProd) {
        return ["https://*.namera.ai"];
      }
      return ["http://localhost:3000"];
    })();

    return AuthConfig.of({
      ...env,
      advanced: {
        ipAddress: {
          disableIpTracking: false,
          ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
        },
      },
      emailVerification: {
        expiresIn: Duration.minutes(15),
      },
      session: {
        cookieName: "auth-token",
        expiresIn: Duration.days(7),
        secure: env.isProd,
        ...(env.isProd ? { domain: "namera.ai" } : {}),
      },
      trustedOrigins,
    });
  }),
);
