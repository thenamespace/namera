import type {
  GetActiveSessionKeyOperationResponse,
  GetActiveSessionKeyOperationRequest,
} from "@namera-ai/protocol/dto";

/** A recovered request must match the displayed permission and its gas consent. */
export function recoverSponsoredApproval(
  target: GetActiveSessionKeyOperationRequest,
  operation: GetActiveSessionKeyOperationResponse["operation"],
) {
  const request = operation?.retryRequest;
  if (
    operation?.status !== "awaiting-signature" ||
    !request?.sponsor ||
    request.installationId !== target.installationId ||
    request.kind !== target.kind
  )
    return undefined;
  return request;
}
