import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const feedbackRelations = defineRelationsPart(schema, (r) => ({
  feedback: {
    // Feedback retains its authenticated author independently of workspace membership.
    user: r.one.user({ from: r.feedback.userId, to: r.user.id, optional: false }),
    // Organization is submission context, not ownership of the private platform inbox.
    organization: r.one.organization({ from: r.feedback.organizationId, to: r.organization.id }),
  },
}));
