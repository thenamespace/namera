import { Schema, SchemaGetter } from "effect";

import {
  CreateEvmSignaturePolicy,
  EthereumAddress,
  SupportedEvmChainId,
} from "@namera-ai/protocol";

import type { SignaturePolicyInput } from "../types";

const SignatureFields = Schema.Struct({
  allowedTypes: CreateEvmSignaturePolicy.fields.allowedTypes,
  rules: Schema.Array(
    Schema.Struct({
      chainId: SupportedEvmChainId,
      verifyingContract: Schema.String.pipe(Schema.decodeTo(EthereumAddress)),
      name: Schema.String,
      version: Schema.String,
      matchName: Schema.Boolean,
      matchVersion: Schema.Boolean,
      primaryTypes: Schema.String.check(
        Schema.isPattern(/^\s*[A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*\s*$/, {
          message: "Enter message type names separated by commas",
        }),
        Schema.makeFilter((value) => {
          const names = value.split(",").map((name) => name.trim());
          return new Set(names).size === names.length ? undefined : "Message types must be unique";
        }),
      ),
    }),
  ),
});

export const toSignatureFormInput = (policy: SignaturePolicyInput) => ({
  allowedTypes: policy.allowedTypes,
  rules: (policy.typedDataRules ?? []).map((rule) => ({
    chainId: rule.chainId,
    verifyingContract: rule.verifyingContract,
    name: rule.name ?? "",
    version: rule.version ?? "",
    matchName: rule.name !== undefined,
    matchVersion: rule.version !== undefined,
    primaryTypes: rule.primaryTypes.join(", "),
  })),
});

export const SignaturePolicyForm = SignatureFields.pipe(
  Schema.decodeTo(CreateEvmSignaturePolicy, {
    decode: SchemaGetter.transform((value) => ({
      type: "evm.signature" as const,
      version: 1 as const,
      allowedTypes: value.allowedTypes,
      ...(value.allowedTypes.includes("typed-data") && value.rules.length > 0
        ? {
            typedDataRules: value.rules.map((rule) => ({
              chainId: rule.chainId,
              verifyingContract: rule.verifyingContract,
              ...(rule.matchName ? { name: rule.name } : {}),
              ...(rule.matchVersion ? { version: rule.version } : {}),
              primaryTypes: rule.primaryTypes.split(",").map((name) => name.trim()),
            })),
          }
        : {}),
    })),
    encode: SchemaGetter.transform((policy) => ({
      allowedTypes: policy.allowedTypes,
      rules: (policy.typedDataRules ?? []).map((rule) => ({
        chainId: rule.chainId,
        verifyingContract: EthereumAddress.make(rule.verifyingContract),
        name: rule.name ?? "",
        version: rule.version ?? "",
        matchName: rule.name !== undefined,
        matchVersion: rule.version !== undefined,
        primaryTypes: rule.primaryTypes.join(", "),
      })),
    })),
  }),
);

export type SignatureFormInput = typeof SignaturePolicyForm.Encoded;
