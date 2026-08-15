import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

import { auditRelations } from "./audit.js";
import { authRelations } from "./auth.js";
import { billingRelations } from "./billing.js";
import { coreRelations } from "./core.js";
import { jobRelations } from "./jobs.js";
import { notificationRelations } from "./notification.js";
import { oauthRelations } from "./oauth.js";

// Drizzle requires the schema-wide empty part first so every table is inferred.
const schemaRelations = defineRelationsPart(schema);

// Relation parts must remain ordered after the schema-wide inference part.
export const relations = {
  ...schemaRelations,
  ...authRelations,
  ...oauthRelations,
  ...auditRelations,
  ...billingRelations,
  ...coreRelations,
  ...jobRelations,
  ...notificationRelations,
};
