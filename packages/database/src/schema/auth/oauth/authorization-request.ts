import type {
  OAuthAuthorizationRequestId,
  OAuthClientId,
  OrganizationId,
  UserId,
} from "@namera-ai/protocol";
import type {
  OAuthAuthorizationRequest,
  OAuthAuthorizationRequestStatus,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, jsonb, text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "../core/user.js";
import { organization } from "../organization/organization.js";
import { oauthClient } from "./client.js";

export const oauthAuthorizationRequest = authSchema.table(
  "oauth_authorization_request",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthAuthorizationRequestId>(),
    clientId: text("client_id")
      .notNull()
      .$type<OAuthClientId>()
      .references(() => oauthClient.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    redirectUri: text("redirect_uri").notNull(),
    responseType: text("response_type").notNull().$type<"code">(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().$type<"S256">(),
    resource: text("resource").notNull(),
    requestedScopes: jsonb("requested_scopes")
      .notNull()
      .$type<OAuthAuthorizationRequest["requestedScopes"]>(),
    state: text("state"),
    status: text("status").notNull().$type<OAuthAuthorizationRequestStatus>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    approvedAt: createTimestampField("approved_at"),
    deniedAt: createTimestampField("denied_at"),
    ...timestamps,
  },
  (table) => [
    index("oauth_authorization_request_client_status_idx").on(table.clientId, table.status),
    index("oauth_authorization_request_user_created_idx").on(table.userId, table.createdAt),
    check(
      "oauth_authorization_request_status_check",
      sql`${table.status} IN ('pending', 'approved', 'denied', 'expired')`,
    ),
    check("oauth_authorization_request_response_type_check", sql`${table.responseType} = 'code'`),
    check(
      "oauth_authorization_request_challenge_method_check",
      sql`${table.codeChallengeMethod} = 'S256'`,
    ),
  ],
);
