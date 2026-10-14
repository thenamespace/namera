import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  invitation,
  organizationMember,
  signingKey,
  wallet,
  sessionKey,
  sessionKeyInstallation,
} from "#/schema/index";

export interface BillingResourceUsage {
  readonly members: number;
  readonly pendingInvitations: number;
  readonly softwareWallets: number;
  readonly hsmWallets: number;
  readonly localWallets: number;
  readonly oneClawWallets: number;
  readonly localSessionKeys: number;
  readonly oneClawSessionKeys: number;
}

export interface BillingUsageRepositoryService {
  readonly getForOrganization: (
    organizationId: OrganizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<BillingResourceUsage, DatabaseError>;
}

export class BillingUsageRepository extends Context.Service<
  BillingUsageRepository,
  BillingUsageRepositoryService
>()("@namera-ai/database/BillingUsageRepository") {
  static readonly layer: Layer.Layer<BillingUsageRepository, never, Database> = Layer.effect(
    BillingUsageRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return BillingUsageRepository.of({
        getForOrganization: Effect.fn("database.billingUsageRepository.getForOrganization")(
          function* (organizationId, now) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);

            // Acceptance moves a seat between these tables; both counts must
            // use one statement snapshot, including unlocked billing reads.
            const seatRows = yield* db
              .select({
                members: count(),
                pendingInvitations: sql<number>`(select count(*) from ${invitation}
                  where ${invitation.organizationId} = ${organizationId}
                    and ${invitation.status} = 'pending'
                    and ${invitation.expiresAt} > ${encodedNow.toISOString()}::timestamptz)`.mapWith(
                  Number,
                ),
              })
              .from(organizationMember)
              .where(
                and(
                  eq(organizationMember.organizationId, organizationId),
                  isNull(organizationMember.removedAt),
                ),
              );
            const softwareWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(signingKey, eq(wallet.signingKeyId, signingKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(signingKey.custody, "namera-managed"),
                  sql`${signingKey.data}->>'protectionLevel' = 'software'`,
                  ne(signingKey.status, "destroyed"),
                ),
              );
            const hsmWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(signingKey, eq(wallet.signingKeyId, signingKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(signingKey.custody, "namera-managed"),
                  sql`${signingKey.data}->>'protectionLevel' = 'hsm'`,
                  ne(signingKey.status, "destroyed"),
                ),
              );
            const localWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(signingKey, eq(wallet.signingKeyId, signingKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(signingKey.custody, "local"),
                  ne(signingKey.status, "destroyed"),
                ),
              );
            const oneClawWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(signingKey, eq(wallet.signingKeyId, signingKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(signingKey.custody, "namera-managed"),
                  sql`${signingKey.data}->>'type' = '1claw'`,
                  ne(signingKey.status, "destroyed"),
                ),
              );
            // Count sessions, not installations: a multi-network key occupies one slot.
            // Missing installations remain occupied; disabled signers also retain their slot.
            // Signature-only policies do not expire onchain transaction authority.
            const sessionRows = yield* db
              .select({
                local: sql<number>`count(*) filter (where ${signingKey.custody} = 'local')`.mapWith(
                  Number,
                ),
                oneClaw:
                  sql<number>`count(*) filter (where ${signingKey.custody} = 'namera-managed' and ${signingKey.data}->>'type' = '1claw')`.mapWith(
                    Number,
                  ),
              })
              .from(sessionKey)
              .innerJoin(signingKey, eq(sessionKey.signingKeyId, signingKey.id))
              .where(
                and(
                  eq(sessionKey.organizationId, organizationId),
                  ne(sessionKey.status, "revoked"),
                  ne(signingKey.status, "destroyed"),
                  sql`(
                  not exists (select 1 from ${sessionKeyInstallation} i where i.session_key_id = ${sessionKey.id})
                  or exists (select 1 from ${sessionKeyInstallation} i where i.session_key_id = ${sessionKey.id}
                    and (i.data->'authorization'->>'validUntil')::bigint > extract(epoch from ${encodedNow.toISOString()}::timestamptz))
                )`,
                ),
              );
            return {
              members: seatRows[0]?.members ?? 0,
              pendingInvitations: seatRows[0]?.pendingInvitations ?? 0,
              softwareWallets: softwareWalletRows[0]?.value ?? 0,
              hsmWallets: hsmWalletRows[0]?.value ?? 0,
              localWallets: localWalletRows[0]?.value ?? 0,
              oneClawWallets: oneClawWalletRows[0]?.value ?? 0,
              localSessionKeys: sessionRows[0]?.local ?? 0,
              oneClawSessionKeys: sessionRows[0]?.oneClaw ?? 0,
            };
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
