import type {
  ExecutionId,
  ExecutionSubmissionId,
  SessionKeyId,
  WalletId,
} from "@namera-ai/protocol";
import {
  type ExecuteRequest as ExecuteRequestType,
  type SimulateExecutionRequest,
} from "@namera-ai/protocol/dto";
import { generateUniqueId } from "@namera-ai/utils";

import type { NameraTransport } from "#/transport";

export type ListExecutionsOptions = {
  readonly cursor?: ExecutionId;
  readonly walletId?: WalletId;
  readonly sessionKeyId?: SessionKeyId;
};

export class ExecutionClient {
  constructor(private readonly transport: NameraTransport) {}

  execute(request: ExecuteRequestType) {
    const idempotencyKey = generateUniqueId();

    return this.transport.requestWithRetry(
      this.transport.client.execution.execute({
        payload: request,
        headers: { "idempotency-key": idempotencyKey },
      }),
    );
  }

  simulate(request: SimulateExecutionRequest) {
    return this.transport.request(this.transport.client.execution.simulate({ payload: request }));
  }

  getStatus(submissionId: ExecutionSubmissionId) {
    return this.transport.request(
      this.transport.client.execution.getSubmission({ params: { submissionId } }),
    );
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
