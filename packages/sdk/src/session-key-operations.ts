import { Schema } from "effect";

import { SessionKeyId, SessionKeyOperationId } from "@namera-ai/protocol";
import {
  PasskeyAuthenticationResponse,
  type PrepareSessionKeyOperationRequest,
} from "@namera-ai/protocol/dto";
import { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import { inputDecoder } from "#/input-validation";
import type * as Input from "#/inputs";
import { failure, success } from "#/result";
import type { NameraTransport } from "#/transport";

const decodeTarget = inputDecoder(
  Schema.Struct({
    sessionKeyId: SessionKeyId,
    chainId: SupportedEvmChainId,
    kind: Schema.Literals(["install", "uninstall"]),
  }),
);
const decodeSponsor = inputDecoder(Schema.Boolean);
const decodeApproval = inputDecoder(
  Schema.Struct({
    operationId: SessionKeyOperationId,
    approval: Schema.Union([
      Schema.Struct({ type: Schema.Literal("1claw") }),
      Schema.Struct({ type: Schema.Literal("passkey"), response: PasskeyAuthenticationResponse }),
    ]),
  }),
);

const resolveInstallation = async (
  transport: NameraTransport,
  input: Input.SessionKeyOperationTarget,
) => {
  const decoded = decodeTarget(input);
  if (!decoded.success) return decoded;
  const session = await transport.request(
    transport.client.sessionKey.get({ params: { sessionKeyId: decoded.data.sessionKeyId } }),
  );
  if (!session.success) return session;
  const installation = session.data.installations.find(
    ({ chainId }) => chainId === decoded.data.chainId,
  );
  if (installation === undefined)
    return failure({
      kind: "contract",
      message: "The session has no installation configured on this network.",
      status: null,
      cause: null,
    });
  return success({
    installationId: installation.id,
    kind: decoded.data.kind,
    owner: session.data.wallet.owner,
  });
};

const prepare = async (
  transport: NameraTransport,
  owner: { readonly custody: "local" | "namera-managed" },
  request: PrepareSessionKeyOperationRequest,
) => {
  if (owner.custody === "namera-managed") {
    return transport.requestWithRetry(
      transport.client.sessionKey.prepareManagedOperation({ payload: request }),
    );
  }
  const result = await transport.requestWithRetry(
    transport.client.sessionKey.prepareOperation({ payload: request }),
  );
  if (!result.success) return result;
  return success({ ...result.data, approval: "passkey" as const });
};

/** Preparation is transport only. Validate against independently reviewed authority before approval. */
export const prepareSessionKeyOperation = async (
  transport: NameraTransport,
  input: Input.PrepareSessionKeyOperationRequest,
) => {
  const sponsor = decodeSponsor(input.sponsor ?? true);
  if (!sponsor.success) return sponsor;
  const target = await resolveInstallation(transport, input);
  if (!target.success) return target;
  return prepare(transport, target.data.owner, {
    installationId: target.data.installationId,
    kind: target.data.kind,
    sponsor: sponsor.data,
    idempotencyKey: globalThis.crypto.randomUUID(),
  });
};

export const recoverSessionKeyOperation = async (
  transport: NameraTransport,
  input: Input.SessionKeyOperationTarget,
) => {
  const target = await resolveInstallation(transport, input);
  if (!target.success) return target;
  const active = await transport.request(
    transport.client.sessionKey.getActiveOperation({
      params: {
        installationId: target.data.installationId,
        kind: target.data.kind,
      },
    }),
  );
  if (!active.success) return active;
  const operation = active.data.operation;
  if (operation === null) return success({ operation: null });
  if (
    operation.retryRequest !== null &&
    (operation.retryRequest.installationId !== target.data.installationId ||
      operation.retryRequest.kind !== target.data.kind)
  )
    return failure({
      kind: "contract",
      message: "The recovered operation does not match the selected installation.",
      status: null,
      cause: null,
    });
  const preparation =
    operation.retryRequest === null
      ? null
      : await prepare(transport, target.data.owner, operation.retryRequest);
  if (preparation !== null && !preparation.success) return preparation;
  if (preparation !== null && preparation.data.operationId !== operation.operationId)
    return failure({
      kind: "contract",
      message: "The recovered preparation does not match the active operation.",
      status: null,
      cause: null,
    });
  return success({
    operation: {
      operationId: operation.operationId,
      status: operation.status,
      preparation: preparation?.data ?? null,
    },
  });
};

export const approveSessionKeyOperation = async (
  transport: NameraTransport,
  input: Input.ApproveSessionKeyOperationRequest,
) => {
  const decoded = decodeApproval(input);
  if (!decoded.success) return decoded;
  const { operationId, approval } = decoded.data;
  // Accepted signatures are durable. Retrying uses the same operation and assertion.
  return approval.type === "1claw"
    ? transport.requestWithRetry(
        transport.client.sessionKey.approveManagedOperation({ payload: { operationId } }),
      )
    : transport.requestWithRetry(
        transport.client.sessionKey.completeOperation({
          payload: { operationId, response: approval.response },
        }),
      );
};
