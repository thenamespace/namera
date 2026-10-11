import { DateTime, Schema } from "effect";

import { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import {
  SimulateExecutionRequest,
  PrepareExecutionRequest,
  CompleteExecutionRequest,
  ListExecutionsRequest,
} from "@namera-ai/protocol/dto";
import { verifyMessage } from "viem";

import { inputDecoder } from "#/input-validation";
import type * as Input from "#/inputs";
import { failure } from "#/result";
import { validateLocalExecution, validateManagedExecution } from "#/signing/execution-validation";
import type { ResolveSessionSigner, LocalSessionSigner } from "#/signing/local-session";
import type { NameraTransport } from "#/transport";

export type { ListExecutionsOptions } from "#/inputs";

const decodePrepare = inputDecoder(PrepareExecutionRequest);
const decodeComplete = inputDecoder(CompleteExecutionRequest);
const decodeSimulate = inputDecoder(SimulateExecutionRequest);
const decodeList = inputDecoder(ListExecutionsRequest);
const decodeSubmissionId = inputDecoder(ExecutionSubmissionId);
const decodeExecutionId = inputDecoder(ExecutionId);

export class ExecutionClient {
  constructor(
    private readonly transport: NameraTransport,
    private readonly resolveSigner?: ResolveSessionSigner,
    private readonly maxGasCostWei?: bigint,
  ) {}

  async prepare(input: Input.PrepareExecutionRequest) {
    const decoded = decodePrepare(input);
    if (!decoded.success) return decoded;
    return this.#prepare(decoded.data);
  }

  #prepare(request: PrepareExecutionRequest) {
    const idempotencyKey = globalThis.crypto.randomUUID();

    return this.transport.requestWithRetry(
      this.transport.client.execution.prepare({
        payload: request,
        headers: { "idempotency-key": idempotencyKey },
      }),
    );
  }

  async complete(input: Input.CompleteExecutionRequest) {
    const decoded = decodeComplete(input);
    if (!decoded.success) return decoded;
    // The submission already identifies the immutable operation. Retries send
    // the same signature; they must never prepare or sign another operation.
    return this.transport.requestWithRetry(
      this.transport.client.execution.complete({ payload: decoded.data }),
    );
  }

  async execute(input: Input.ExecuteRequest) {
    const decoded = decodePrepare(input);
    if (!decoded.success) return decoded;
    const request = decoded.data;
    const prepared = await this.#prepare(request);
    if (!prepared.success) return prepared;
    if (prepared.data.signing.method === "server") {
      try {
        validateManagedExecution(request, prepared.data, this.maxGasCostWei);
      } catch {
        return failure({
          kind: "signer",
          code: "PREPARED_EXECUTION_INVALID",
          message: "The prepared execution does not match the request or fee consent.",
          status: null,
          cause: null,
        });
      }
      return this.complete({
        namespace: request.namespace,
        submissionId: prepared.data.submissionId,
      });
    }
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
        message:
          "Unable to open the local signer. Import the session key on this machine and unlock the OS keyring, or check your custom resolver.",
        status: null,
        cause: null,
      });
    }
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

  async simulate(input: Input.SimulateExecutionRequest) {
    const decoded = decodeSimulate(input);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.execution.simulate({ payload: decoded.data }),
    );
  }

  async getStatus(submissionId: string) {
    const decoded = decodeSubmissionId(submissionId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.execution.getSubmission({ params: { submissionId: decoded.data } }),
    );
  }

  async get(executionId: string) {
    const decoded = decodeExecutionId(executionId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.execution.get({ params: { executionId: decoded.data } }),
    );
  }

  async list(options: Input.ListExecutionsOptions = {}) {
    const decoded = decodeList(options);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.execution.list({
        query: decoded.data,
      }),
    );
  }
}
