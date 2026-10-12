import { CreateEvmContractAccessPolicy } from "@namera-ai/protocol";
import { FileScriptIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.contract-access",
  onchain: "contract-access",
  name: evmPolicyDisplayNames["evm.contract-access"],
  description: "Only call this contract through Namera.",
  cardinality: "singleton",
  icon: FileScriptIcon,
  schema: CreateEvmContractAccessPolicy,
  initial: { type: "evm.contract-access", version: 1, address: "0x" },
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
