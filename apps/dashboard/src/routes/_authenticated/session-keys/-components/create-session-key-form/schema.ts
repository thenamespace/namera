import { Schema } from "effect";

import { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";

import { isChainOperationEnabled } from "@/lib/chain-availability";
import { OptionalFormDescription } from "@/lib/form-description";

import { hasTransactionAccess } from "./policies/catalog";

export const CreateSessionKeyFormSchema = CreateEvmSessionKeyRequest.mapFields(
  ({ signer: _signer, ...fields }) => ({
    ...fields,
    custody: Schema.Literals(["local", "namera-managed"]),
    metadata: fields.metadata.mapFields((metadata) => ({
      ...metadata,
      description: OptionalFormDescription,
    })),
  }),
).check(
  Schema.makeFilter((request) =>
    request.onchain.installations.every(({ chainId }) => isChainOperationEnabled(chainId))
      ? undefined
      : { path: ["onchain", "installations"], issue: "Choose networks that are not paused." },
  ),
  Schema.makeFilter((request) =>
    request.onchain.installations.every(
      (installation) =>
        hasTransactionAccess(installation.permissions) || installation.allowSignatures,
    )
      ? undefined
      : {
          path: ["onchain", "installations"],
          issue: "Add access on every network. Spending and gas limits alone do not grant access.",
        },
  ),
  Schema.makeFilter((request) => {
    const signatures = request.policies.filter((policy) => policy.type === "evm.signature");
    if (request.policies.length !== signatures.length || signatures.length > 1)
      return {
        path: ["policies"],
        issue: "Use the policy picker to configure this key’s access and limits.",
      };
    const enabled = request.onchain.installations
      .filter(({ allowSignatures }) => allowSignatures)
      .map(({ chainId }) => chainId);
    if (
      signatures.some((policy) =>
        policy.typedDataRules?.some((rule) => !enabled.includes(rule.chainId)),
      )
    )
      return {
        path: ["policies"],
        issue:
          "Enable signatures on every typed-data rule's network, or remove the affected rules.",
      };
    return enabled.length > 0 === (signatures.length === 1)
      ? undefined
      : {
          path: ["policies"],
          issue: "Configure Signatures to include both signing rules and owner-approved authority.",
        };
  }),
);
