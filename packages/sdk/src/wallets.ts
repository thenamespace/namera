import type { WalletId } from "@namera-ai/protocol";
import {
  type GetWalletResponse as GetWalletResponseType,
  type ListWalletsResponse as ListWalletsResponseType,
} from "@namera-ai/protocol/dto";

import type { NameraResult } from "#/result";
import type { NameraTransport } from "#/transport";

export class WalletClient {
  constructor(private readonly transport: NameraTransport) {}

  list(): Promise<NameraResult<ListWalletsResponseType>> {
    return this.transport.request(this.transport.client.wallet.list());
  }

  get(walletId: WalletId): Promise<NameraResult<GetWalletResponseType>> {
    return this.transport.request(this.transport.client.wallet.get({ params: { walletId } }));
  }
}
