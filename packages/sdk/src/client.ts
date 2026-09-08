import type {
  SignRequest as SignRequestType,
  VerifySignatureRequest,
} from "@namera-ai/protocol/dto";
import { generateUniqueId } from "@namera-ai/utils";

import { AuthClient } from "#/auth";
import { ExecutionClient } from "#/executions";
import { SessionKeyClient } from "#/session-keys";
import { NameraTransport, type NameraClientConfig } from "#/transport";
import { WalletClient } from "#/wallets";

export class NameraClient {
  readonly auth: AuthClient;
  readonly executions: ExecutionClient;
  readonly sessionKeys: SessionKeyClient;
  readonly wallets: WalletClient;

  readonly #transport: NameraTransport;

  constructor(config: NameraClientConfig) {
    this.#transport = new NameraTransport(config);
    this.auth = new AuthClient(this.#transport);
    this.executions = new ExecutionClient(this.#transport, config.resolveSessionSigner);
    this.sessionKeys = new SessionKeyClient(this.#transport);
    this.wallets = new WalletClient(this.#transport);
  }

  sign(request: SignRequestType) {
    const idempotencyKey = generateUniqueId();

    if (request.type === "message") {
      return this.#transport.requestWithRetry(
        this.#transport.client.signature.sign({
          headers: { "idempotency-key": idempotencyKey },
          payload: request,
        }),
      );
    }

    return this.#transport.requestWithRetry(
      this.#transport.client.signature.sign({
        headers: { "idempotency-key": idempotencyKey },
        payload: request,
      }),
    );
  }

  verifySignature(request: VerifySignatureRequest) {
    if (request.type === "message") {
      return this.#transport.requestWithRetry(
        this.#transport.client.signature.verify({ payload: request }),
      );
    }

    return this.#transport.requestWithRetry(
      this.#transport.client.signature.verify({ payload: request }),
    );
  }
}
