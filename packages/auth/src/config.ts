import type { Cookies } from "effect/unstable/http";

import { Duration, Effect, Layer, Context } from "effect";

import { AuthEnv } from "./env";

export type AuthConfig = AuthEnv & {
  trustedOrigins: string[];
  emailVerification: {
    expiresIn: Duration.Duration;
  };
  session: {
    cookieOpts: Cookies.Cookie["options"];
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

export const AuthConfig = Context.Service<AuthConfig>("AuthConfig");

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

    const cookieOpts: Cookies.Cookie["options"] = {
      ...(isProd ? { domain: "namera.ai" } : {}),
      secure: isProd,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    };

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
        cookieOpts,
        cookieName: "auth-token",
        expiresIn: Duration.days(7),
        secure: isProd,
        ...(isProd ? { domain: "namera.ai" } : {}),
      },
      trustedOrigins,
    });
  }),
);
