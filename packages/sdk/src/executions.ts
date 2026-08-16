import type { ExecutionId, ExecutionSubmissionId } from "@namera-ai/protocol";
import {
  type ExecuteRequest as ExecuteRequestType,
  type ExecuteResponse as ExecuteResponseType,
  type GetExecutionResponse as GetExecutionResponseType,
  type GetExecutionSubmissionResponse as GetExecutionSubmissionResponseType,
  type ListExecutionsResponse as ListExecutionsResponseType,
} from "@namera-ai/protocol/dto";

import type { NameraResult } from "#/result";
import type { NameraTransport } from "#/transport";

export type ExecuteOptions = {
  readonly idempotencyKey: string;
};

export type ListExecutionsOptions = {
  readonly cursor?: ExecutionId;
};

export class ExecutionClient {
  constructor(private readonly transport: NameraTransport) {}

  execute(
    request: ExecuteRequestType,
    options: ExecuteOptions,
  ): Promise<NameraResult<ExecuteResponseType>> {
    return this.transport.request(
      this.transport.client.execution.execute({
        payload: request,
        headers: { "idempotency-key": options.idempotencyKey },
      }),
    );
  }

  getSubmission(
    submissionId: ExecutionSubmissionId,
  ): Promise<NameraResult<GetExecutionSubmissionResponseType>> {
    return this.transport.request(
      this.transport.client.execution.getSubmission({ params: { submissionId } }),
    );
  }

  get(executionId: ExecutionId): Promise<NameraResult<GetExecutionResponseType>> {
    return this.transport.request(this.transport.client.execution.get({ params: { executionId } }));
  }

  list(options: ListExecutionsOptions = {}): Promise<NameraResult<ListExecutionsResponseType>> {
    return this.transport.request(
      this.transport.client.execution.list({
        query: options.cursor === undefined ? {} : { cursor: options.cursor },
      }),
    );
  }
}
