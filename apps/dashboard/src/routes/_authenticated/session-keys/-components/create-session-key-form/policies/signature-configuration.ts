import type { SignaturePolicyInput } from "@/components/policy/evm";

// The UI edits one capability; the existing wire contract has two independent
// enforcement layers. Both must be included in the owner's reviewed request.
export function signatureConfiguration(policy?: SignaturePolicyInput) {
  return { policies: policy ? [policy] : [], allowSignatures: policy !== undefined };
}
