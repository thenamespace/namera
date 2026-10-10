import type { PrepareSignatureRequest, VerifySignatureRequest } from "@namera-ai/protocol/dto";

import { AuthClient } from "#/auth";
import { ExecutionClient } from "#/executions";
import { SessionKeyClient } from "#/session-keys";
import { SignatureClient } from "#/signatures";
import { NameraTransport, type NameraClientConfig } from "#/transport";
import { WalletClient } from "#/wallets";

export class NameraClient {
  readonly auth: AuthClient;
  readonly executions: ExecutionClient;
  readonly sessionKeys: SessionKeyClient;
  readonly wallets: WalletClient;
  readonly signatures: SignatureClient;

  readonly #transport: NameraTransport;

  constructor(config: NameraClientConfig) {
    this.#transport = new NameraTransport(config);
    this.auth = new AuthClient(this.#transport);
    this.executions = new ExecutionClient(
      this.#transport,
      config.resolveSessionSigner,
      config.maxGasCostWei,
    );
    this.sessionKeys = new SessionKeyClient(this.#transport);
    this.wallets = new WalletClient(this.#transport);
    this.signatures = new SignatureClient(this.#transport, config.resolveSessionSigner);
  }

  sign(request: PrepareSignatureRequest) {
    return this.signatures.sign(request);
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
