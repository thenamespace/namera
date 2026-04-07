import { Duration, Effect, Layer, ServiceMap } from "effect";

import { AuthEnv } from "./env";

export type AuthConfig = AuthEnv & {
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

export const AuthConfig = ServiceMap.Service<AuthConfig>("AuthConfig");

export const layer = Layer.effect(
  AuthConfig,
  Effect.gen(function* () {
    const env = yield* AuthEnv;
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
