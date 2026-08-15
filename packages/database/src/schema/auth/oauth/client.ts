import type { OAuthClientId } from "@namera-ai/protocol";
import type {
  OAuthClient,
  OAuthClientRegistrationType,
  OAuthClientStatus,
  OAuthGrantType,
  OAuthResponseType,
  OAuthTokenEndpointAuthMethod,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const oauthClient = authSchema.table(
  "oauth_client",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthClientId>(),
    clientId: text("client_id").notNull(),
    registrationType: text("registration_type").notNull().$type<OAuthClientRegistrationType>(),
    clientName: text("client_name").notNull(),
    clientUri: text("client_uri"),
    logoUri: text("logo_uri"),
    redirectUris: jsonb("redirect_uris").notNull().$type<OAuthClient["redirectUris"]>(),
    grantTypes: jsonb("grant_types").notNull().$type<ReadonlyArray<OAuthGrantType>>(),
    responseTypes: jsonb("response_types").notNull().$type<ReadonlyArray<OAuthResponseType>>(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method")
      .notNull()
      .$type<OAuthTokenEndpointAuthMethod>(),
    metadata: jsonb("metadata").notNull().$type<OAuthClient["metadata"]>(),
    status: text("status").notNull().$type<OAuthClientStatus>(),
    metadataExpiresAt: createTimestampField("metadata_expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("oauth_client_client_id_uidx").on(table.clientId),
    index("oauth_client_status_idx").on(table.status),
    check(
      "oauth_client_registration_type_check",
      sql`${table.registrationType} IN ('metadata-document', 'pre-registered', 'dynamic')`,
    ),
    check("oauth_client_status_check", sql`${table.status} IN ('active', 'disabled')`),
    check("oauth_client_auth_method_check", sql`${table.tokenEndpointAuthMethod} = 'none'`),
  ],
);
