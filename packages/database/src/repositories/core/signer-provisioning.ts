import { Context, Effect, Layer, Schema } from "effect";

import type {
  ActorId,
  CredentialId,
  OrganizationId,
  SignerProvisioningId,
  SigningKeyId,
} from "@namera-ai/protocol";
import { SignerProvisioning, SigningKeyInsert } from "@namera-ai/protocol/model";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { signerProvisioning as table } from "#/schema/index";

export type ProvisioningLease = {
  readonly id: SignerProvisioningId;
  readonly organizationId: OrganizationId;
  readonly leaseToken: string;
};
type RequestIdentity = {
  readonly organizationId: OrganizationId;
  readonly actorId: ActorId;
  readonly provider: string;
  readonly purpose: SignerProvisioning["purpose"];
  readonly idempotencyKey: string;
};
const owned = (lease: ProvisioningLease) =>
  and(
    eq(table.id, lease.id),
    eq(table.organizationId, lease.organizationId),
    eq(table.leaseToken, lease.leaseToken),
    sql`${table.leaseExpiresAt} > clock_timestamp()`,
  );

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    reserve: Effect.fn("database.signerProvisioning.reserve")(function* (
      input: RequestIdentity & {
        readonly id: SignerProvisioningId;
        readonly requestHash: string;
        readonly signingKeyId: SigningKeyId;
        readonly credentialId: CredentialId;
      },
    ) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .insert(table)
        .values({ ...input, status: "pending", stage: "reserved" })
        .onConflictDoNothing();
      const row = yield* db.query.signerProvisioning.findFirst({
        where: {
          organizationId: { eq: input.organizationId },
          actorId: { eq: input.actorId },
          provider: { eq: input.provider },
          purpose: { eq: input.purpose },
          idempotencyKey: { eq: input.idempotencyKey },
        },
      });
      return Schema.decodeUnknownSync(SignerProvisioning)(row);
    }, mapRepositoryError),
    claim: Effect.fn("database.signerProvisioning.claim")(function* (lease: ProvisioningLease) {
      const db = yield* transactionOrDatabase(database);
      const identity = and(eq(table.id, lease.id), eq(table.organizationId, lease.organizationId));
      const available = or(
        isNull(table.leaseToken),
        sql`${table.leaseExpiresAt} <= clock_timestamp()`,
      );
      // An expired owner may still have an HTTP request running at the provider.
      yield* db
        .update(table)
        .set({ status: "recovery_required", leaseToken: null, leaseExpiresAt: null })
        .where(and(identity, available, eq(table.status, "remote_started")));
      const rows = yield* db
        .update(table)
        .set({
          leaseToken: lease.leaseToken,
          leaseExpiresAt: sql`clock_timestamp() + interval '60 seconds'`,
        })
        .where(and(identity, available, inArray(table.status, ["pending", "ready"])))
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(SignerProvisioning)(rows[0]) : undefined;
    }, mapRepositoryError),
    renew: Effect.fn("database.signerProvisioning.renew")(function* (lease: ProvisioningLease) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(table)
        .set({ leaseExpiresAt: sql`clock_timestamp() + interval '60 seconds'` })
        .where(owned(lease))
        .returning({ id: table.id });
      return rows.length === 1;
    }, mapRepositoryError),
    lock: Effect.fn("database.signerProvisioning.lock")(function* (lease: ProvisioningLease) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db.select().from(table).where(owned(lease)).for("update");
      return rows[0] ? Schema.decodeUnknownSync(SignerProvisioning)(rows[0]) : undefined;
    }, mapRepositoryError),
    stage: Effect.fn("database.signerProvisioning.stage")(function* (
      lease: ProvisioningLease,
      stage: string,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(table)
        .set({ status: "remote_started", stage })
        .where(and(owned(lease), inArray(table.status, ["pending", "remote_started"])))
        .returning({ id: table.id });
      return rows.length === 1;
    }, mapRepositoryError),
    ready: Effect.fn("database.signerProvisioning.ready")(function* (
      lease: ProvisioningLease,
      signer: SigningKeyInsert,
    ) {
      if (!signer.id) return yield* Effect.die("Provisioned signer requires a planned ID");
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(table)
        .set({
          status: "ready",
          stage: "signer_verified",
          signer: Schema.encodeSync(SigningKeyInsert)(signer),
        })
        .where(
          and(
            owned(lease),
            eq(table.status, "remote_started"),
            eq(table.signingKeyId, signer.id),
            eq(table.organizationId, signer.organizationId),
            eq(table.purpose, signer.purpose),
          ),
        )
        .returning({ id: table.id });
      return rows.length === 1;
    }, mapRepositoryError),
    complete: Effect.fn("database.signerProvisioning.complete")(function* (
      lease: ProvisioningLease,
      resourceId: string,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(table)
        .set({ status: "completed", stage: "completed", resourceId })
        .where(and(owned(lease), eq(table.status, "ready")))
        .returning({ id: table.id });
      return rows.length === 1;
    }, mapRepositoryError),
    release: Effect.fn("database.signerProvisioning.release")(function* (lease: ProvisioningLease) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .update(table)
        .set({
          status: sql`CASE WHEN ${table.status} = 'remote_started' THEN 'recovery_required' ELSE ${table.status} END`,
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(
          and(
            eq(table.id, lease.id),
            eq(table.organizationId, lease.organizationId),
            eq(table.leaseToken, lease.leaseToken),
          ),
        );
    }, mapRepositoryError),
  };
});

export class SignerProvisioningRepository extends Context.Service<
  SignerProvisioningRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/SignerProvisioningRepository") {
  static readonly layer = Layer.effect(SignerProvisioningRepository, make);
}
