import type { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import { type ExecuteRequest as ExecuteRequestType } from "@namera-ai/protocol/dto";

import type { NameraTransport } from "#/transport";

export type ExecuteOptions = {
  readonly idempotencyKey: string;
};

export type ListExecutionsOptions = {
  readonly cursor?: ExecutionId;
};

export class ExecutionClient {
  constructor(private readonly transport: NameraTransport) {}

  execute(request: ExecuteRequestType, options: ExecuteOptions) {
    return this.transport.request(
      this.transport.client.execution.execute({
        payload: request,
        headers: { "idempotency-key": options.idempotencyKey },
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
