import { DateTime, Schema } from "effect";

import type {
  ExecutionId,
  ExecutionSubmissionId,
  SessionKeyId,
  WalletId,
} from "@namera-ai/protocol";
import {
  type ExecuteRequest as ExecuteRequestType,
  type SimulateExecutionRequest,
  type PrepareExecutionRequest,
  CompleteExecutionRequest,
} from "@namera-ai/protocol/dto";
import { verifyMessage } from "viem";

import { failure } from "#/result";
import { validateLocalExecution } from "#/signing/execution-validation";
import type { ResolveSessionSigner, LocalSessionSigner } from "#/signing/local-session";
import type { NameraTransport } from "#/transport";

export type ListExecutionsOptions = {
  readonly cursor?: ExecutionId;
  readonly walletId?: WalletId;
  readonly sessionKeyId?: SessionKeyId;
};

export class ExecutionClient {
  constructor(
    private readonly transport: NameraTransport,
    private readonly resolveSigner?: ResolveSessionSigner,
  ) {}

  prepare(request: PrepareExecutionRequest) {
    const idempotencyKey = globalThis.crypto.randomUUID();

    return this.transport.requestWithRetry(
      this.transport.client.execution.prepare({
        payload: request,
        headers: { "idempotency-key": idempotencyKey },
      }),
    );
  }

  complete(request: CompleteExecutionRequest) {
    // The submission already identifies the immutable operation. Retries send
    // the same signature; they must never prepare or sign another operation.
    return this.transport.requestWithRetry(
      this.transport.client.execution.complete({ payload: request }),
    );
  }

  async execute(request: ExecuteRequestType) {
    if (this.resolveSigner === undefined)
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNER_REQUIRED",
        message: "Configure a local session signer before executing transactions.",
        status: null,
        cause: null,
      });

    let signer: LocalSessionSigner;
    try {
      signer = await this.resolveSigner(request);
    } catch {
      // Resolver exceptions may contain keystore passwords or private material.
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNER_UNAVAILABLE",
        message: "The local session signer could not be opened.",
        status: null,
        cause: null,
      });
    }
    const prepared = await this.prepare(request);
    if (!prepared.success) return prepared;

    let message: `0x${string}`;
    try {
      message = validateLocalExecution({
        request,
        response: prepared.data,
        binding: signer.binding,
        now: DateTime.nowUnsafe(),
        ...(signer.maxGasCostWei === undefined ? {} : { maxGasCostWei: signer.maxGasCostWei }),
      });
    } catch {
      return failure({
        kind: "signer",
        code: "PREPARED_EXECUTION_INVALID",
        message:
          "The prepared transaction does not match local session authorization or fee consent.",
        status: null,
        cause: null,
      });
    }

    let completion: CompleteExecutionRequest;
    try {
      const signature = await signer.signMessage({ raw: message });
      completion = Schema.decodeUnknownSync(CompleteExecutionRequest)({
        namespace: "eip155",
        submissionId: prepared.data.submissionId,
        signature,
      });
      if (
        !(await verifyMessage({
          address: signer.binding.signerAddress,
          message: { raw: message },
          signature,
        }))
      ) {
        return failure({
          kind: "signer",
          code: "LOCAL_SIGNATURE_INVALID",
          message: "The signature does not match the selected local session key.",
          status: null,
          cause: null,
        });
      }
      // A browser prompt or keystore unlock can outlive the preparation.
      validateLocalExecution({
        request,
        response: prepared.data,
        binding: signer.binding,
        now: DateTime.nowUnsafe(),
        ...(signer.maxGasCostWei === undefined ? {} : { maxGasCostWei: signer.maxGasCostWei }),
      });
    } catch {
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNATURE_INVALID",
        message: "The local session could not produce a valid, unexpired signature.",
        status: null,
        cause: null,
      });
    }
    return this.complete(completion);
  }

  simulate(request: SimulateExecutionRequest) {
    return this.transport.request(this.transport.client.execution.simulate({ payload: request }));
  }

  getStatus(submissionId: ExecutionSubmissionId) {
    return this.transport.request(
      this.transport.client.execution.getSubmission({ params: { submissionId } }),
    );
  }

  get(executionId: ExecutionId) {
    return this.transport.request(this.transport.client.execution.get({ params: { executionId } }));
  }

  list(options: ListExecutionsOptions = {}) {
    return this.transport.request(
      this.transport.client.execution.list({
        query: {
          ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
          ...(options.walletId === undefined ? {} : { walletId: options.walletId }),
          ...(options.sessionKeyId === undefined ? {} : { sessionKeyId: options.sessionKeyId }),
        },
      }),
    );
  }
}
