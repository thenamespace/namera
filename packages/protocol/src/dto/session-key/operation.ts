import { Schema } from "effect";

import { SessionKeyInstallationId, SessionKeyOperationId } from "#/common/index";
import { EvmPreparedExecution } from "#/evm/index";
import { NonEmptyString } from "#/model/common";
import {
  SessionKeyOperationKind,
  SessionKeyOperationStatus,
} from "#/model/core/session-key-operation";

import { PasskeyAuthenticationOptions, PasskeyAuthenticationResponse } from "../wallet/passkey.js";

export const PrepareSessionKeyOperationRequest = Schema.Struct({
  installationId: SessionKeyInstallationId,
  kind: SessionKeyOperationKind,
  idempotencyKey: NonEmptyString,
  sponsor: Schema.Boolean,
}).annotate({
  identifier: "PrepareSessionKeyOperationRequest",
  description:
    "Prepare the stored install or uninstall action. No client-supplied calls are accepted. Reuse the same idempotency key when retrying.",
});

export const PrepareSessionKeyOperationResponse = Schema.Struct({
  operationId: SessionKeyOperationId,
  namespace: Schema.Literal("eip155"),
  options: PasskeyAuthenticationOptions,
  prepared: EvmPreparedExecution,
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({ identifier: "PrepareSessionKeyOperationResponse" });

export const CompleteSessionKeyOperationRequest = Schema.Struct({
  operationId: SessionKeyOperationId,
  response: PasskeyAuthenticationResponse,
}).annotate({ identifier: "CompleteSessionKeyOperationRequest" });

export const SessionKeyOperationResponse = Schema.Struct({
  operationId: SessionKeyOperationId,
  status: SessionKeyOperationStatus,
}).annotate({ identifier: "SessionKeyOperationResponse" });

export const GetSessionKeyOperationRequest = Schema.Struct({
  operationId: SessionKeyOperationId,
}).annotate({ identifier: "GetSessionKeyOperationRequest" });

export type PrepareSessionKeyOperationRequest = typeof PrepareSessionKeyOperationRequest.Type;
export type PrepareSessionKeyOperationResponse = typeof PrepareSessionKeyOperationResponse.Type;
export type CompleteSessionKeyOperationRequest = typeof CompleteSessionKeyOperationRequest.Type;
export type SessionKeyOperationResponse = typeof SessionKeyOperationResponse.Type;
