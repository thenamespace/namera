import { Schema } from "effect";

import { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";

import { isChainOperationEnabled } from "@/lib/chain-availability";
import { OptionalFormDescription } from "@/lib/form-description";

import { hasTransactionAccess } from "./policies/catalog";

export const CreateSessionKeyFormSchema = CreateEvmSessionKeyRequest.mapFields(
  ({ signer: _signer, ...fields }) => ({
    ...fields,
    metadata: fields.metadata.mapFields((metadata) => ({
      ...metadata,
      description: OptionalFormDescription,
    })),
  }),
).check(
  Schema.makeFilter((request) =>
    request.onchain.chains.every(isChainOperationEnabled)
      ? undefined
      : { path: ["onchain", "chains"], issue: "Choose networks that are not paused." },
  ),
  Schema.makeFilter((request) =>
    hasTransactionAccess(request.onchain.permissions) || request.onchain.allowSignatures
      ? undefined
      : {
          path: ["onchain", "permissions"],
          issue: "Add an access policy. Spending and gas limits do not grant transaction access.",
        },
  ),
  Schema.makeFilter((request) => {
    const signatures = request.policies.filter((policy) => policy.type === "evm.signature");
    if (request.policies.length !== signatures.length || signatures.length > 1)
      return {
        path: ["policies"],
        issue: "Use the policy picker to configure this key’s access and limits.",
      };
    return Boolean(request.onchain.allowSignatures) === (signatures.length === 1)
      ? undefined
      : {
          path: ["onchain", "allowSignatures"],
          issue: "Configure Signatures to include both signing rules and owner-approved authority.",
        };
  }),
);
