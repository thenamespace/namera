import {
  DefaultModuleAddress,
  type HookType,
  installValidationActions,
  PermissionBuilder,
  SingleSignerValidationModule,
  TimeRangeModule,
} from "@alchemy/smart-accounts";
import type { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { type Address, type Chain, type Client, type Hex, type Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";

import { assertSafeSessionPermissions } from "./permission-safety.js";
import { toAlchemyPermission } from "./permissions.js";

// The SDK exports HookType only as a type, not a runtime value.
const validationHookType = "0x01" satisfies HookType;
const executionHookType = "0x00" satisfies HookType;

export type CompiledEvmSession = {
  readonly installCallData: Hex;
  readonly uninstallCallData: Hex;
  readonly moduleAddress: Address;
  readonly entityId: number;
  readonly isGlobal: boolean;
  readonly hooks: ReadonlyArray<{ readonly address: Address; readonly entityId: number }>;
};

/** Compiles owner operations only. No key generation, signatures or RPC writes. */
export const compileEvmSession = async (
  client: Client<Transport, Chain, SmartAccount>,
  authorization: EvmSessionAuthorization,
): Promise<CompiledEvmSession> => {
  assertSafeSessionPermissions(client.account.address, authorization.permissions);
  const builder = new PermissionBuilder({
    client,
    entityId: authorization.entityId,
    key: { type: "secp256k1", publicKey: authorization.signerAddress },
    nonce: 0n,
    // compileRaw does not apply the builder's deadline; that only affects
    // deferred installation. Attach the authoritative lifetime explicitly.
    hooks: [
      TimeRangeModule.buildHook(
        {
          entityId: authorization.entityId,
          validAfter: authorization.validAfter,
          validUntil: authorization.validUntil,
        },
        DefaultModuleAddress.TIME_RANGE,
      ),
    ],
  }).addPermissions({ permissions: authorization.permissions.map(toAlchemyPermission) });

  // Compilation mutates the upstream builder. Calling it a second time would
  // append duplicate hooks, so inspect the resulting arguments without recompiling.
  const installCallData = await builder.compileRaw();
  const compiled = await builder.compileInstallArgs();
  const uninstallCallData = await installValidationActions(client).encodeUninstallValidation({
    moduleAddress: compiled.validationConfig.moduleAddress,
    entityId: authorization.entityId,
    uninstallData: SingleSignerValidationModule.encodeOnUninstallData({
      entityId: authorization.entityId,
    }),
    // Contract storage prepends hooks to separate linked lists. Removal expects
    // validation hooks first, then execution hooks, each in reverse insertion order.
    // Allowlist cleanup needs full target/selector tuples; native/time decode
    // the leading uint32 and ignore trailing bytes.
    hookUninstallDatas: [
      ...compiled.hooks
        .filter(({ hookConfig }) => hookConfig.hookType === validationHookType)
        .toReversed(),
      ...compiled.hooks
        .filter(({ hookConfig }) => hookConfig.hookType === executionHookType)
        .toReversed(),
    ].map(({ initData }) => initData),
  });

  return {
    installCallData,
    uninstallCallData,
    moduleAddress: compiled.validationConfig.moduleAddress,
    entityId: authorization.entityId,
    isGlobal: compiled.validationConfig.isGlobal,
    hooks: compiled.hooks.map(({ hookConfig }) => ({
      address: hookConfig.address,
      entityId: hookConfig.entityId,
    })),
  };
};
