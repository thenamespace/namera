import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";

// IPermissionedRegistry and LibRegistryRoles from ENS contracts-v2.
// https://docs.ens.domains/ensv2/permissioned-registry/
const permissionedRegistryInterfaceId = "0xc18bd555";
const registrarRole = 1n;
const registryAbi = parseAbi([
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "function roles(uint256 resource, address account) view returns (uint256)",
]);

export type SubregistryReview = "ready" | "not-contract" | "not-registry" | "missing-role";

/** Read-only preflight; the registry enforces its current roles when an agent executes. */
export async function reviewSubregistry(
  input: { readonly registry: Address; readonly account: Address },
  client: PublicClient,
): Promise<SubregistryReview> {
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const code = await client.getCode({ address: input.registry, blockNumber });
  if (!code || code === "0x") return "not-contract";

  try {
    const supportsRegistry = await client.readContract({
      address: input.registry,
      abi: registryAbi,
      functionName: "supportsInterface",
      args: [permissionedRegistryInterfaceId],
      blockNumber,
    });
    if (!supportsRegistry) return "not-registry";

    const roles = await client.readContract({
      address: input.registry,
      abi: registryAbi,
      functionName: "roles",
      args: [0n, input.account],
      blockNumber,
    });
    return (roles & registrarRole) === registrarRole ? "ready" : "missing-role";
  } catch (error) {
    if (error instanceof BaseError) {
      const contractFailure = error.walk(
        (cause) =>
          cause instanceof ContractFunctionRevertedError ||
          cause instanceof ContractFunctionZeroDataError,
      );
      if (contractFailure) return "not-registry";
    }
    throw error;
  }
}
