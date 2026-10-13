import { Effect, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { ChainName, Ens, getCoinType, validateAddress, type SubnameDTO } from "@namera-ai/ens";
import {
  EnsUnavailableError,
  IdentityError,
  WalletNotFoundError,
  type ActorId,
  type EnsLabel,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import {
  IdentityDetail,
  IdentityListResponse,
  IdentityView,
  type UpdateIdentityRecordsRequest,
} from "@namera-ai/protocol/dto";

import { Audit } from "#/audit/layer";

import { ensPolicy, toEnsName } from "./data.js";

type AccountScope = { readonly organizationId: OrganizationId; readonly walletId: WalletId };
type NameScope = AccountScope & { readonly label: EnsLabel };
const unavailable = () => new EnsUnavailableError({ code: "ENS_UNAVAILABLE" });

const belongsTo = (name: SubnameDTO, address: string) =>
  name.parentName === ensPolicy.parentName &&
  name.owner?.toLowerCase() === address.toLowerCase() &&
  name.fullName === `${name.label}.${ensPolicy.parentName}` &&
  !name.label.includes(".");
const view = (name: SubnameDTO) =>
  Schema.decodeUnknownEffect(IdentityView)({
    fullName: name.fullName,
    label: name.label,
    owner: name.owner,
    texts: name.texts,
    addresses: name.addresses,
    contenthash: name.contenthash ?? null,
  }).pipe(Effect.mapError(unavailable));
export const makeIdentities = Effect.gen(function* () {
  const ens = yield* Ens;
  const repository = yield* Repository;
  const audit = yield* Audit;
  const transaction = yield* TransactionService;

  const account = Effect.fnUntraced(function* (scope: AccountScope) {
    const wallet = yield* repository.core.wallet
      .findById(scope.walletId, scope.organizationId)
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    if (!wallet || wallet.wallet.status !== "active" || wallet.signingKey.status !== "active")
      return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
    return wallet.wallet.data.address;
  });
  const load = Effect.fnUntraced(function* (scope: NameScope) {
    const address = yield* account(scope);
    const name = yield* ens
      .getSingleSubname(toEnsName(scope.label))
      .pipe(Effect.mapError(unavailable));
    if (!name || !belongsTo(name, address))
      return yield* new IdentityError({ code: "IDENTITY_UNAVAILABLE" });
    return name;
  });
  const get = Effect.fn("application.ens.getIdentity")(function* (scope: NameScope) {
    const name = yield* load(scope);
    const records = yield* ens.getDataRecords(name.fullName).pipe(Effect.mapError(unavailable));
    return yield* Schema.decodeUnknownEffect(IdentityDetail)({
      ...(yield* view(name)),
      records,
    }).pipe(Effect.mapError(unavailable));
  });
  const recordAudit = (
    scope: NameScope & { readonly actorId: ActorId },
    action: "created" | "records_updated",
    applied: number,
  ) =>
    audit
      .organization({
        organizationId: scope.organizationId,
        actorId: scope.actorId,
        event: "identity.changed",
        resourceType: "wallet",
        resourceId: scope.walletId,
        data: { version: 1, name: toEnsName(scope.label), action, applied },
      })
      .pipe(Effect.catchTag("DatabaseError", Effect.die));

  return {
    getIdentity: get,
    identityNetworks: Effect.succeed(
      Object.entries(ChainName).map(([label, key]) => ({
        key,
        label,
        coinType: String(getCoinType(key)),
      })),
    ),
    listIdentities: Effect.fn("application.ens.listIdentities")(function* (
      scope: AccountScope & { readonly page?: number | undefined },
    ) {
      const owner = yield* account(scope);
      const result = yield* ens
        .getFilteredSubnames({
          parentName: ensPolicy.parentName,
          owner,
          page: scope.page ?? 1,
          size: 20,
        })
        .pipe(Effect.mapError(unavailable));
      // Never trust an upstream filter as an authorization boundary.
      const items = yield* Effect.forEach(
        result.items.filter((name) => belongsTo(name, owner)),
        view,
      );
      return yield* Schema.decodeUnknownEffect(IdentityListResponse)({ ...result, items }).pipe(
        Effect.mapError(unavailable),
      );
    }),
    createIdentity: Effect.fn("application.ens.createIdentity")(function* (
      scope: NameScope & { readonly actorId: ActorId },
    ) {
      return yield* transaction
        .run(
          Effect.gen(function* () {
            // Serialize Namera creation requests across server instances without storing identities.
            yield* repository.core.wallet
              .findByIdForUpdate(scope.walletId, scope.organizationId)
              .pipe(Effect.catchTag("DatabaseError", Effect.die));
            const owner = yield* account(scope);
            const name = toEnsName(scope.label);
            const existing = yield* ens.getSingleSubname(name).pipe(Effect.mapError(unavailable));
            if (existing) {
              if (belongsTo(existing, owner)) return yield* get(scope);
              return yield* new IdentityError({ code: "NAME_UNAVAILABLE" });
            }
            for (let page = 1; ; page += 1) {
              const owned = yield* ens
                .getFilteredSubnames({ parentName: ensPolicy.parentName, owner, page, size: 20 })
                .pipe(Effect.mapError(unavailable));
              if (owned.items.some((identity) => belongsTo(identity, owner)))
                return yield* new IdentityError({ code: "ACCOUNT_IDENTITY_EXISTS" });
              if (page * owned.size >= owned.totalItems) break;
              if (owned.size <= 0 || owned.items.length === 0) return yield* unavailable();
            }
            yield* ens
              .createSubname({
                parentName: ensPolicy.parentName,
                label: scope.label,
                owner,
                addresses: [
                  { chain: ChainName.Ethereum, value: owner },
                  { chain: ChainName.Default, value: owner },
                ],
              })
              .pipe(
                Effect.mapError((error) =>
                  error.reason === "ALREADY_EXISTS"
                    ? new IdentityError({ code: "NAME_UNAVAILABLE" })
                    : unavailable(),
                ),
              );
            yield* recordAudit(scope, "created", 1);
            return yield* get(scope);
          }),
        )
        .pipe(Effect.catchTag("DatabaseError", Effect.die));
    }),
    updateIdentityRecords: Effect.fn("application.ens.updateIdentityRecords")(function* (
      scope: NameScope & {
        readonly actorId: ActorId;
        readonly request: UpdateIdentityRecordsRequest;
      },
    ) {
      const name = yield* load(scope);
      const seen = new Set<string>();
      // Validate the entire batch before making any external changes.
      for (const change of scope.request.changes) {
        const id = `${change.type}:${change.key}`;
        if (seen.has(id) || JSON.stringify(change.value).length > 4096)
          return yield* new IdentityError({ code: "INVALID_RECORD" });
        seen.add(id);
        if (change.type === "address") {
          if (!Object.values(ChainName).includes(change.key as ChainName))
            return yield* new IdentityError({ code: "INVALID_RECORD" });
          const value = change.value;
          if (value !== null)
            yield* Effect.try({
              try: () => validateAddress(value, change.key as ChainName),
              catch: () => new IdentityError({ code: "INVALID_RECORD" }),
            });
        }
      }
      let applied = 0;
      for (const change of scope.request.changes) {
        const operation =
          change.type === "text"
            ? change.value === null
              ? ens.deleteTextRecord(name.fullName, change.key)
              : ens.addTextRecord(name.fullName, change.key, change.value)
            : change.type === "address"
              ? change.value === null
                ? ens.deleteAddressRecord(name.fullName, change.key as ChainName)
                : ens.addAddressRecord(name.fullName, change.key as ChainName, change.value)
              : change.value === null
                ? ens.deleteDataRecord(name.fullName, change.key)
                : ens.addDataRecord(name.fullName, change.key, change.value);
        yield* operation.pipe(
          Effect.catchTag("EnsError", () =>
            Effect.gen(function* () {
              if (applied > 0) {
                yield* recordAudit(scope, "records_updated", applied);
                return yield* new IdentityError({ code: "PARTIAL_UPDATE", applied });
              }
              return yield* unavailable();
            }),
          ),
        );
        applied += 1;
      }
      yield* recordAudit(scope, "records_updated", applied);
      return yield* get(scope);
    }),
  };
});
