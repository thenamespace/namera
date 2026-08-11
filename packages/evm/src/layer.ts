import { Context, Effect, Layer } from "effect";

import { EvmClients } from "./clients/service.js";
import type { EvmClientsService } from "./clients/service.js";

export interface EvmService {
  readonly clients: EvmClientsService;
}

export class Evm extends Context.Service<Evm, EvmService>()("@namera-ai/evm/Evm") {
  static readonly layer = Layer.effect(
    Evm,
    Effect.gen(function* () {
      const clients = yield* EvmClients;
      return Evm.of({ clients });
    }),
  ).pipe(Layer.provide(EvmClients.layer));
}
