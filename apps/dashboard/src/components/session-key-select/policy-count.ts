import { Schema } from "effect";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { EvmSessionPermission } from "@namera-ai/protocol/evm";

export function sessionKeyPolicyCount(session: {
  policies: readonly unknown[];
  installations: ReadonlyArray<{
    authorization: Pick<
      SessionKeyResponse["installations"][number]["authorization"],
      "permissions" | "allowSignatures"
    >;
  }>;
}) {
  const onchain = new Set<string>();
  for (const installation of session.installations) {
    for (const permission of installation.authorization.permissions) {
      onchain.add(JSON.stringify(Schema.encodeSync(EvmSessionPermission)(permission)));
    }
    if (installation.authorization.allowSignatures) onchain.add("signature");
  }
  // Network copies are one configured policy. Mandatory lifetime/network
  // settings are not entries in the optional policy list.
  return session.policies.length + onchain.size;
}
