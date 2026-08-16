import { type SignRequest as SignRequestType } from "@namera-ai/protocol/dto";

import { ExecutionClient } from "#/executions";
import { SessionKeyClient } from "#/session-keys";
import { NameraTransport, type NameraClientConfig } from "#/transport";
import { WalletClient } from "#/wallets";

export class NameraClient {
  readonly executions: ExecutionClient;
  readonly sessionKeys: SessionKeyClient;
  readonly wallets: WalletClient;

  readonly #transport: NameraTransport;

  constructor(config: NameraClientConfig) {
    this.#transport = new NameraTransport(config);
    this.executions = new ExecutionClient(this.#transport);
    this.sessionKeys = new SessionKeyClient(this.#transport);
    this.wallets = new WalletClient(this.#transport);
  }

  sign(request: SignRequestType) {
    if (request.type === "message") {
      return this.#transport.request(this.#transport.client.signature.sign({ payload: request }));
    }

    return this.#transport.request(this.#transport.client.signature.sign({ payload: request }));
  }
}
