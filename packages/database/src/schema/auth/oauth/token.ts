import type {
  OAuthAuthorizationId,
  OAuthClientId,
  OAuthTokenFamilyId,
  OAuthTokenId,
} from "@namera-ai/protocol";
import type { OAuthToken, OAuthTokenType } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { authSchema } from "../common.js";
import { oauthAuthorization } from "./authorization.js";
import { oauthClient } from "./client.js";

export const oauthToken = authSchema.table(
  "oauth_token",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthTokenId>(),
    authorizationId: text("authorization_id").notNull().$type<OAuthAuthorizationId>(),
    clientId: text("client_id")
      .notNull()
      .$type<OAuthClientId>()
      .references(() => oauthClient.id, { onDelete: "restrict" }),
    type: text("type").notNull().$type<OAuthTokenType>(),
    tokenHash: text("token_hash").notNull(),
    familyId: text("family_id").$type<OAuthTokenFamilyId>(),
    parentId: text("parent_id").$type<OAuthTokenId>(),
    resource: text("resource").notNull(),
    scopes: jsonb("scopes").notNull().$type<OAuthToken["scopes"]>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    consumedAt: createTimestampField("consumed_at"),
    revokedAt: createTimestampField("revoked_at"),
    lastUsedAt: createTimestampField("last_used_at"),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_token_hash_uidx").on(table.tokenHash),
    foreignKey({
      name: "oauth_token_authorization_client_fk",
      columns: [table.authorizationId, table.clientId],
      foreignColumns: [oauthAuthorization.id, oauthAuthorization.clientId],
    }).onDelete("restrict"),
    foreignKey({
      name: "oauth_token_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    index("oauth_token_authorization_type_idx").on(table.authorizationId, table.type),
    index("oauth_token_family_idx").on(table.familyId),
    check("oauth_token_type_check", sql`${table.type} IN ('access', 'refresh')`),
    check(
      "oauth_token_shape_check",
      sql`(${table.type} = 'access' AND ${table.familyId} IS NULL AND ${table.parentId} IS NULL AND ${table.consumedAt} IS NULL) OR (${table.type} = 'refresh' AND ${table.familyId} IS NOT NULL)`,
    ),
  ],
);
