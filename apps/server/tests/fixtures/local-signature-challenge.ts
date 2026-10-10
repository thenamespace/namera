import type { PrepareSignatureResponse } from "@namera-ai/protocol/dto";

export const localSignatureChallenge = (response: PrepareSignatureResponse) => {
  if (response.signing.method !== "eth_signTypedData_v4")
    throw new Error("Expected local challenge");
  return response.signing.typedData;
};
