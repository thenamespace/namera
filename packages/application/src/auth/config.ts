import { Config } from "effect";

import { authPolicy } from "./data.js";

const AuthEnvironmentConfig = Config.all({
  apiPublicOrigin: Config.url("AUTH_API_PUBLIC_ORIGIN"),
  dashboardPublicOrigin: Config.url("AUTH_DASHBOARD_PUBLIC_ORIGIN"),
});

export const AuthConfig = AuthEnvironmentConfig.pipe(
  Config.map(({ apiPublicOrigin, dashboardPublicOrigin }) => ({
    magicLink: authPolicy.magicLink,
    session: authPolicy.session,
    cookie: authPolicy.cookie,
    returnTo: authPolicy.returnTo,
    invitation: authPolicy.invitation,
    oauth: authPolicy.oauth,
    apiPublicOrigin,
    dashboardPublicOrigin,
  })),
);

export type AuthConfigValue = Config.Success<typeof AuthConfig>;
