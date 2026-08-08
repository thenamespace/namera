import type { SystemRoleId } from "@namera-ai/protocol";
import type {
  MemberPermission,
  SystemRoleKey,
  SystemRoleMetadata,
} from "@namera-ai/protocol/model";
import { text, jsonb } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const systemRole = authSchema.table(
  "system_role",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SystemRoleId>(),
    key: text("key").notNull().$type<SystemRoleKey>(),
    metadata: jsonb("metadata").notNull().$type<SystemRoleMetadata>(),
    permissions: text("permissions").array().notNull().$type<MemberPermission>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("system_role_key_uidx").on(table.key)],
);
