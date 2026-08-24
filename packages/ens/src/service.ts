import { Context, Effect, Layer, Redacted } from "effect";

import {
  createOffchainClient,
  type ChainName,
  type CreateSubnameRequest,
  type GetAvailableResponse,
  type GetRecordResponse,
  type OffchainClient,
  type PagedResponse,
  type QuerySubnamesRequest,
  type SubnameDTO,
  type UpdateSubnameRequest,
} from "@thenamespace/offchain-manager";

import { runEnsRequest, toEnsError } from "./client.js";
import { EnsConfig } from "./config.js";
import type { EnsError } from "./error.js";

export interface EnsService {
  readonly createSubname: (request: CreateSubnameRequest) => Effect.Effect<void, EnsError>;
  readonly updateSubname: (
    subname: string,
    request: UpdateSubnameRequest,
  ) => Effect.Effect<void, EnsError>;
  readonly deleteSubname: (fullSubname: string) => Effect.Effect<void, EnsError>;
  readonly isSubnameAvailable: (
    fullSubname: string,
  ) => Effect.Effect<GetAvailableResponse, EnsError>;
  readonly getSingleSubname: (fullSubname: string) => Effect.Effect<SubnameDTO | null, EnsError>;
  readonly getFilteredSubnames: (
    query: QuerySubnamesRequest,
  ) => Effect.Effect<PagedResponse<SubnameDTO[]>, EnsError>;
  readonly addAddressRecord: (
    subname: string,
    chain: ChainName,
    value: string,
  ) => Effect.Effect<void, EnsError>;
  readonly deleteAddressRecord: (
    subname: string,
    chain: ChainName,
  ) => Effect.Effect<void, EnsError>;
  readonly setDefaultEvmAddress: (subname: string, value: string) => Effect.Effect<void, EnsError>;
  readonly addTextRecord: (
    subname: string,
    key: string,
    value: string,
  ) => Effect.Effect<void, EnsError>;
  readonly deleteTextRecord: (subname: string, key: string) => Effect.Effect<void, EnsError>;
  readonly getTextRecords: (fullSubname: string) => Effect.Effect<Record<string, string>, EnsError>;
  readonly getTextRecord: (
    fullSubname: string,
    key: string,
  ) => Effect.Effect<GetRecordResponse, EnsError>;
  readonly addDataRecord: (
    fullSubname: string,
    key: string,
    data: unknown,
  ) => Effect.Effect<void, EnsError>;
  readonly deleteDataRecord: (subname: string, key: string) => Effect.Effect<void, EnsError>;
  readonly getDataRecords: (
    fullSubname: string,
  ) => Effect.Effect<Record<string, unknown>, EnsError>;
  readonly getDataRecord: (
    fullSubname: string,
    key: string,
  ) => Effect.Effect<GetRecordResponse, EnsError>;
}

export const makeEnsService = (client: OffchainClient): EnsService => ({
  createSubname: Effect.fn("ens.createSubname")((request) =>
    runEnsRequest("createSubname", () => client.createSubname(request)),
  ),
  updateSubname: Effect.fn("ens.updateSubname")((subname, request) =>
    runEnsRequest("updateSubname", () => client.updateSubname(subname, request)),
  ),
  deleteSubname: Effect.fn("ens.deleteSubname")((fullSubname) =>
    runEnsRequest("deleteSubname", () => client.deleteSubname(fullSubname)),
  ),
  isSubnameAvailable: Effect.fn("ens.isSubnameAvailable")((fullSubname) =>
    runEnsRequest("isSubnameAvailable", () => client.isSubnameAvailable(fullSubname)),
  ),
  getSingleSubname: Effect.fn("ens.getSingleSubname")((fullSubname) =>
    runEnsRequest("getSingleSubname", () => client.getSingleSubname(fullSubname)),
  ),
  getFilteredSubnames: Effect.fn("ens.getFilteredSubnames")((query) =>
    runEnsRequest("getFilteredSubnames", () => client.getFilteredSubnames(query)),
  ),
  addAddressRecord: Effect.fn("ens.addAddressRecord")((subname, chain, value) =>
    runEnsRequest("addAddressRecord", () => client.addAddressRecord(subname, chain, value)),
  ),
  deleteAddressRecord: Effect.fn("ens.deleteAddressRecord")((subname, chain) =>
    runEnsRequest("deleteAddressRecord", () => client.deleteAddressRecord(subname, chain)),
  ),
  setDefaultEvmAddress: Effect.fn("ens.setDefaultEvmAddress")((subname, value) =>
    runEnsRequest("setDefaultEvmAddress", () => client.setDefaultEvmAddress(subname, value)),
  ),
  addTextRecord: Effect.fn("ens.addTextRecord")((subname, key, value) =>
    runEnsRequest("addTextRecord", () => client.addTextRecord(subname, key, value)),
  ),
  deleteTextRecord: Effect.fn("ens.deleteTextRecord")((subname, key) =>
    runEnsRequest("deleteTextRecord", () => client.deleteTextRecord(subname, key)),
  ),
  getTextRecords: Effect.fn("ens.getTextRecords")((fullSubname) =>
    runEnsRequest("getTextRecords", () => client.getTextRecords(fullSubname)),
  ),
  getTextRecord: Effect.fn("ens.getTextRecord")((fullSubname, key) =>
    runEnsRequest("getTextRecord", () => client.getTextRecord(fullSubname, key)),
  ),
  addDataRecord: Effect.fn("ens.addDataRecord")((fullSubname, key, data) =>
    runEnsRequest("addDataRecord", () => client.addDataRecord(fullSubname, key, data)),
  ),
  deleteDataRecord: Effect.fn("ens.deleteDataRecord")((subname, key) =>
    runEnsRequest("deleteDataRecord", () => client.deleteDataRecord(subname, key)),
  ),
  getDataRecords: Effect.fn("ens.getDataRecords")((fullSubname) =>
    runEnsRequest("getDataRecords", () => client.getDataRecords(fullSubname)),
  ),
  getDataRecord: Effect.fn("ens.getDataRecord")((fullSubname, key) =>
    runEnsRequest("getDataRecord", () => client.getDataRecord(fullSubname, key)),
  ),
});

export class Ens extends Context.Service<Ens, EnsService>()("@namera-ai/ens/Ens") {
  static readonly #makeLayer = (mode: "mainnet" | "sepolia") =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const config = yield* EnsConfig;
        const client = yield* Effect.try({
          try: () =>
            createOffchainClient({
              mode,
              timeout: 10_000,
              defaultApiKey: Redacted.value(config.apiKey),
            }),
          catch: (cause) => toEnsError("configure", cause),
        });

        return Ens.of(makeEnsService(client));
      }),
    );

  static readonly layer = this.#makeLayer("mainnet");
  static readonly devLayer = this.#makeLayer("sepolia");
}
