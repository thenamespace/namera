import { encodeFunctionData, namehash, zeroAddress, type PublicClient } from "viem";

const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "node" }],
    outputs: [{ type: "address" }],
  },
] as const;
const registry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;
const setNameAbi = [
  {
    type: "function",
    name: "setName",
    stateMutability: "nonpayable",
    inputs: [{ type: "string", name: "name" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

/** ENSIP-19: discover the Ethereum registrar rather than pinning a deployment. */
export async function primaryNameCall(publicClient: PublicClient, name: string) {
  if (publicClient.chain?.id !== 1) throw new Error("Primary names require Ethereum");
  const to = await publicClient.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "owner",
    args: [namehash("addr.reverse")],
  });
  if (to === zeroAddress) throw new Error("Reverse registrar unavailable");
  return {
    to,
    value: 0n,
    data: encodeFunctionData({ abi: setNameAbi, functionName: "setName", args: [name] }),
  };
}
