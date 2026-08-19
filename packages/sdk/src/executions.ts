import type { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import { type ExecuteRequest as ExecuteRequestType } from "@namera-ai/protocol/dto";
import { generateUniqueId } from "@namera-ai/utils";

import type { NameraTransport } from "#/transport";

export type ListExecutionsOptions = {
  readonly cursor?: ExecutionId;
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

  getSubmission(submissionId: ExecutionSubmissionId) {
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
        query: options.cursor === undefined ? {} : { cursor: options.cursor },
      }),
    );
  }
}
