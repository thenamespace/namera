import { Duration } from "effect";

export interface AuthPolicy {
  readonly magicLink: {
    readonly purpose: "magic-link-signin";
    readonly timeToLive: Duration.Duration;
    readonly resendCooldown: Duration.Duration;
    readonly maximumAttempts: number;
    readonly tokenBytes: number;
    readonly codeDigits: number;
  };
  readonly session: {
    readonly timeToLive: Duration.Duration;
    readonly tokenBytes: number;
  };
  readonly apiKey: {
    readonly prefix: "namera_";
    readonly tokenBytes: number;
    readonly visiblePrefixLength: number;
  };
  readonly oauth: {
    readonly dynamicClientIdPrefix: "namera_mcp_";
    readonly authorizationRequestTimeToLive: Duration.Duration;
    readonly authorizationCodeTimeToLive: Duration.Duration;
    readonly accessTokenTimeToLive: Duration.Duration;
    readonly refreshTokenTimeToLive: Duration.Duration;
    readonly tokenBytes: number;
  };
  readonly cookie: {
    readonly name: string;
    readonly path: "/";
    readonly httpOnly: true;
    readonly sameSite: "lax";
  };
  readonly returnTo: {
    readonly defaultPath: string;
    readonly allowedPrefixes: ReadonlyArray<string>;
  };
  readonly invitation: {
    readonly timeToLive: Duration.Duration;
  };
}

/**
 * Non-secret authentication policy. Edit these values in code and deploy them
 * through the normal review process.
 */
export const authPolicy = {
  magicLink: {
    purpose: "magic-link-signin",
    timeToLive: Duration.minutes(10),
    resendCooldown: Duration.minutes(1),
    maximumAttempts: 5,
    tokenBytes: 32,
    codeDigits: 8,
  },
  session: {
    timeToLive: Duration.days(30),
    tokenBytes: 32,
  },
  apiKey: {
    prefix: "namera_",
    tokenBytes: 32,
    visiblePrefixLength: 14,
  },
  oauth: {
    dynamicClientIdPrefix: "namera_mcp_",
    authorizationRequestTimeToLive: Duration.minutes(10),
    authorizationCodeTimeToLive: Duration.minutes(5),
    accessTokenTimeToLive: Duration.minutes(15),
    refreshTokenTimeToLive: Duration.days(30),
    tokenBytes: 32,
  },
  cookie: {
    name: "auth-token",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  },
  returnTo: {
    defaultPath: "/",
    allowedPrefixes: [
      "/",
      "/accounts",
      "/activity",
      "/assets",
      "/identity",
      "/invitations",
      "/mcp",
      "/oauth",
      "/session-keys",
      "/settings",
      "/templates",
    ],
  },
  invitation: {
    timeToLive: Duration.days(7),
  },
} as const satisfies AuthPolicy;
