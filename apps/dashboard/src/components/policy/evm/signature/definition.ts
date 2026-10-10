import { SignatureIcon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "signature",
  type: "evm.signature",
  name: evmPolicyDisplayNames["evm.signature"],
  description: "Allow message signing, typed-data signing, or both.",
  cardinality: "singleton",
  icon: SignatureIcon,
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
