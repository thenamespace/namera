import type {
  OAuthAuthorizationId,
  OAuthAuthorizationCodeId,
  OAuthClientId,
} from "@namera-ai/protocol";
import type { OAuthAuthorizationCode } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { authSchema } from "../common.js";
import { oauthAuthorization } from "./authorization.js";
import { oauthClient } from "./client.js";

export const oauthAuthorizationCode = authSchema.table(
  "oauth_authorization_code",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthAuthorizationCodeId>(),
    authorizationId: text("authorization_id").notNull().$type<OAuthAuthorizationId>(),
    clientId: text("client_id")
      .notNull()
      .$type<OAuthClientId>()
      .references(() => oauthClient.id, { onDelete: "restrict" }),
    codeHash: text("code_hash").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().$type<"S256">(),
    resource: text("resource").notNull(),
    scopes: jsonb("scopes").notNull().$type<OAuthAuthorizationCode["scopes"]>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    consumedAt: createTimestampField("consumed_at"),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_authorization_code_hash_uidx").on(table.codeHash),
    foreignKey({
      name: "oauth_authorization_code_authorization_client_fk",
      columns: [table.authorizationId, table.clientId],
      foreignColumns: [oauthAuthorization.id, oauthAuthorization.clientId],
    }).onDelete("restrict"),
    index("oauth_authorization_code_authorization_created_idx").on(
      table.authorizationId,
      table.createdAt,
    ),
    check(
      "oauth_authorization_code_challenge_method_check",
      sql`${table.codeChallengeMethod} = 'S256'`,
    ),
  ],
);
