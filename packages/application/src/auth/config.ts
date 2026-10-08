import { Config } from "effect";

import { authPolicy } from "./data.js";

const AuthEnvironmentConfig = Config.all({
  inviteRequired: Config.Boolean("AUTH_INVITE_REQUIRED").pipe(Config.withDefault(true)),
  apiPublicOrigin: Config.URL("AUTH_API_PUBLIC_ORIGIN"),
  dashboardPublicOrigin: Config.URL("AUTH_DASHBOARD_PUBLIC_ORIGIN"),
  adminPublicOrigin: Config.option(Config.URL("ADMIN_CORS_ORIGIN")),
});

export const AuthConfig = AuthEnvironmentConfig.pipe(
  Config.map(({ apiPublicOrigin, dashboardPublicOrigin, adminPublicOrigin, inviteRequired }) => ({
    adminPublicOrigin,
    inviteRequired,
    magicLink: authPolicy.magicLink,
    session: authPolicy.session,
    passkey: authPolicy.passkey,
    cookie: authPolicy.cookie,
    returnTo: authPolicy.returnTo,
    invitation: authPolicy.invitation,
    oauth: authPolicy.oauth,
    apiPublicOrigin,
    dashboardPublicOrigin,
  })),
);

export type AuthConfigValue = Config.Success<typeof AuthConfig>;
