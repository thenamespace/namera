import { Layer } from "effect";

import { OAuthAuthorizationRoute } from "./protocol-authorization.js";
import {
  OAuthAuthorizationServerMetadataRoute,
  protectedResourceMetadataRoute,
} from "./protocol-metadata.js";
import { OAuthRegistrationRoute } from "./protocol-registration.js";
import {
  OAuthDeviceAuthorizationRoute,
  OAuthRevocationRoute,
  OAuthTokenRoute,
} from "./protocol-token.js";

export const OAuthProtocolRoutes = Layer.mergeAll(
  OAuthRegistrationRoute,
  OAuthAuthorizationRoute,
  OAuthDeviceAuthorizationRoute,
  OAuthTokenRoute,
  OAuthRevocationRoute,
  OAuthAuthorizationServerMetadataRoute,
  protectedResourceMetadataRoute("/.well-known/oauth-protected-resource"),
);
