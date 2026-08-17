import type {
  OAuthAuthorizationId,
  OAuthClientId,
  OAuthDeviceAuthorizationId,
  OrganizationId,
  UserId,
} from "@namera-ai/protocol";
import type {
  OAuthDeviceAuthorization,
  OAuthDeviceAuthorizationStatus,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "../core/user.js";
import { organization } from "../organization/organization.js";
import { oauthAuthorization } from "./authorization.js";
import { oauthClient } from "./client.js";

export const oauthDeviceAuthorization = authSchema.table(
  "oauth_device_authorization",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OAuthDeviceAuthorizationId>(),
    clientId: text("client_id")
      .notNull()
      .$type<OAuthClientId>()
      .references(() => oauthClient.id, { onDelete: "restrict" }),
    deviceCodeHash: text("device_code_hash").notNull(),
    userCodeHmac: text("user_code_hmac").notNull(),
    claimedByUserId: text("claimed_by_user_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    authorizationId: text("authorization_id").$type<OAuthAuthorizationId>(),
    requestedScopes: jsonb("requested_scopes")
      .notNull()
      .$type<OAuthDeviceAuthorization["requestedScopes"]>(),
    resource: text("resource").notNull(),
    status: text("status").notNull().$type<OAuthDeviceAuthorizationStatus>(),
    pollingIntervalSeconds: integer("polling_interval_seconds").notNull(),
    lastPolledAt: createTimestampField("last_polled_at"),
    expiresAt: createTimestampField("expires_at").notNull(),
    approvedAt: createTimestampField("approved_at"),
    deniedAt: createTimestampField("denied_at"),
    consumedAt: createTimestampField("consumed_at"),
    metadata: jsonb("metadata").notNull().$type<OAuthDeviceAuthorization["metadata"]>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("oauth_device_authorization_device_code_uidx").on(table.deviceCodeHash),
    uniqueIndex("oauth_device_authorization_user_code_uidx").on(table.userCodeHmac),
    uniqueIndex("oauth_device_authorization_authorization_uidx")
      .on(table.authorizationId)
      .where(sql`${table.authorizationId} IS NOT NULL`),
    foreignKey({
      name: "oauth_device_authorization_authorization_fk",
      columns: [table.authorizationId, table.organizationId],
      foreignColumns: [oauthAuthorization.id, oauthAuthorization.organizationId],
    }).onDelete("restrict"),
    index("oauth_device_authorization_client_status_expiry_idx").on(
      table.clientId,
      table.status,
      table.expiresAt,
    ),
    index("oauth_device_authorization_user_status_expiry_idx").on(
      table.claimedByUserId,
      table.status,
      table.expiresAt,
    ),
    index("oauth_device_authorization_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "oauth_device_authorization_status_check",
      sql`${table.status} IN ('pending', 'approved', 'denied', 'consumed', 'expired')`,
    ),
    check(
      "oauth_device_authorization_poll_interval_check",
      sql`${table.pollingIntervalSeconds} >= 5`,
    ),
  ],
);
