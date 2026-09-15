import type { CurrentActorResponse } from "@namera-ai/protocol/dto";

import { humanize, section, type PrettyPrinter } from "./document.js";

export const authView: PrettyPrinter<{
  readonly profile: string;
  readonly actor: CurrentActorResponse;
}> = ({ profile, actor }, colors) =>
  section(
    "CLI authorization",
    [
      ["Profile", profile],
      ["Authenticated via", actor.type === "api-key" ? "API key" : actor.type.toUpperCase()],
      [
        "Organization ID",
        actor.type === "user" ? actor.data.organization.id : actor.data.organizationId,
      ],
      ...("authorization" in actor.data
        ? ([
            ["Authorization ID", actor.data.authorization.id],
            ["Scopes", actor.data.authorization.scopes],
            ["Expires", actor.data.authorization.expiresAt],
          ] as const)
        : []),
      ...("grants" in actor.data
        ? ([
            [
              "Granted session keys",
              actor.data.grants.map(({ sessionKey }) => ({
                name: sessionKey.metadata.name,
                sessionKeyId: sessionKey.id,
                walletId: sessionKey.walletId,
                status: humanize(sessionKey.status),
              })),
            ],
          ] as const)
        : []),
    ],
    colors,
  );
