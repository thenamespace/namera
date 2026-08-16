import type { SessionKeyId, WalletId } from "@namera-ai/protocol";
import {
  type GetSessionKeyResponse,
  type GetWalletResponse,
  type ListSessionKeysForOrganizationResponse,
  type ListSessionKeysForWalletResponse,
  type ListWalletsResponse,
  type SignRequest as SignRequestType,
  type SignResponse as SignResponseType,
} from "@namera-ai/protocol/dto";

import { ExecutionClient } from "#/executions";
import type { NameraResult } from "#/result";
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

  getWallets(): Promise<NameraResult<ListWalletsResponse>> {
    return this.wallets.list();
  }

  getWallet(walletId: WalletId): Promise<NameraResult<GetWalletResponse>> {
    return this.wallets.get(walletId);
  }

  getSessionKeys(): Promise<NameraResult<ListSessionKeysForOrganizationResponse>> {
    return this.sessionKeys.list();
  }

  getSessionKeysForWallet(
    walletId: WalletId,
  ): Promise<NameraResult<ListSessionKeysForWalletResponse>> {
    return this.sessionKeys.listForWallet(walletId);
  }

  getSessionKey(sessionKeyId: SessionKeyId): Promise<NameraResult<GetSessionKeyResponse>> {
    return this.sessionKeys.get(sessionKeyId);
  }

  sign(request: SignRequestType): Promise<NameraResult<SignResponseType>> {
    if (request.type === "message") {
      return this.#transport.request(this.#transport.client.signature.sign({ payload: request }));
    }

    return this.#transport.request(this.#transport.client.signature.sign({ payload: request }));
  }
}
