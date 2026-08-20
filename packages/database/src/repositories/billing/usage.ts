import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { and, count, eq, gt, isNull, ne } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { invitation, organizationMember, wallet, walletKey } from "#/schema/index";

export interface BillingResourceUsage {
  readonly members: number;
  readonly pendingInvitations: number;
  readonly softwareWallets: number;
  readonly hsmWallets: number;
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

            const memberRows = yield* db
              .select({ value: count() })
              .from(organizationMember)
              .where(
                and(
                  eq(organizationMember.organizationId, organizationId),
                  isNull(organizationMember.removedAt),
                ),
              );
            const invitationRows = yield* db
              .select({ value: count() })
              .from(invitation)
              .where(
                and(
                  eq(invitation.organizationId, organizationId),
                  eq(invitation.status, "pending"),
                  gt(invitation.expiresAt, encodedNow),
                ),
              );
            const softwareWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(walletKey, eq(wallet.walletKeyId, walletKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(walletKey.protectionLevel, "software"),
                  ne(walletKey.status, "destroyed"),
                ),
              );
            const hsmWalletRows = yield* db
              .select({ value: count() })
              .from(wallet)
              .innerJoin(walletKey, eq(wallet.walletKeyId, walletKey.id))
              .where(
                and(
                  eq(wallet.organizationId, organizationId),
                  ne(wallet.status, "archived"),
                  eq(walletKey.protectionLevel, "hsm"),
                  ne(walletKey.status, "destroyed"),
                ),
              );
            return {
              members: memberRows[0]?.value ?? 0,
              pendingInvitations: invitationRows[0]?.value ?? 0,
              softwareWallets: softwareWalletRows[0]?.value ?? 0,
              hsmWallets: hsmWalletRows[0]?.value ?? 0,
            };
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
