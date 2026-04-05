import type { ModularSigner, Policy } from "@zerodev/permissions";
import { toPermissionValidator } from "@zerodev/permissions";
import {
  toECDSASigner,
  toWebAuthnSigner,
  WebAuthnSignerVersion,
} from "@zerodev/permissions/signers";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type { Chain, Client, Hex, Transport } from "viem";

import {
  toCallPolicy,
  toGasPolicy,
  toRateLimitPolicy,
  toSignatureCallerPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from "@/policy";

import { deserializePermissionAccountParams } from "./serialize";
import type { RevokeSessionKeyParams } from "./types";

export const createPolicyFromParams = async (
  policy: Policy,
): Promise<Policy> => {
  switch (policy.policyParams.type) {
    case "call":
      return await toCallPolicy(policy.policyParams);
    case "gas":
      return await toGasPolicy(policy.policyParams);
    case "rate-limit":
      return await toRateLimitPolicy(policy.policyParams);
    case "signature-caller":
      return await toSignatureCallerPolicy(policy.policyParams);
    case "sudo":
      return await toSudoPolicy(policy.policyParams);
    case "timestamp":
      return await toTimestampPolicy(policy.policyParams);
    default:
      throw new Error("Unsupported policy type");
  }
};

export const revokeSessionKey = async (
  _params: RevokeSessionKeyParams,
): Promise<Hex> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const params = deserializePermissionAccountParams(_params.serializedAccount);
  const entryPoint = getEntryPoint(_params.entrypointVersion);
  const kernelVersion = _params.kernelVersion;
  const publicClient = _params.client.client as Client<
    Transport,
    Chain,
    undefined
  >;

  let signer: ModularSigner;
  if ("signer" in _params) {
    signer = await toECDSASigner({
      signer: _params.signer,
    });
  } else {
    signer = await toWebAuthnSigner(publicClient, {
      webAuthnKey: _params.webAuthnKey,
      webAuthnSignerVersion: WebAuthnSignerVersion.V0_0_4_PATCHED,
    });
  }

  const policies = await Promise.all(
    params.permissionParams.policies?.map((policy) =>
      createPolicyFromParams(policy),
    ) || [],
  );

  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion,
    policies,
    signer,
  });

  const txHash = await _params.client.uninstallPlugin({
    plugin: permissionPlugin,
  });

  return txHash;
};
