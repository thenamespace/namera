import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, OrganizationId } from "@namera-ai/protocol";
import { and, eq, gte, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import {
  execution,
  executionSubmission,
  sessionKey,
  signatureOperation,
  wallet,
} from "#/schema/index";

export interface DashboardResourceSummary {
  readonly accounts: {
    readonly total: number;
    readonly active: number;
    readonly withoutActiveSessionKeys: number;
  };
  readonly sessionKeys: {
    readonly total: number;
    readonly active: number;
  };
}

export interface DashboardActivityCount {
  readonly namespace: "eip155";
  readonly date: string;
  readonly operation: "execution" | "failed-execution" | "signature";
  readonly count: number;
}

export interface DashboardOverviewRepositoryService {
  readonly getResources: (
    organizationId: OrganizationId,
  ) => Effect.Effect<DashboardResourceSummary, DatabaseError>;
  readonly getActivity: (
    organizationId: OrganizationId,
    since: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<DashboardActivityCount>, DatabaseError>;
}

const decodeCount = (value: unknown) =>
  Schema.decodeSync(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))(Number(value));

export class DashboardOverviewRepository extends Context.Service<
  DashboardOverviewRepository,
  DashboardOverviewRepositoryService
>()("@namera-ai/database/DashboardOverviewRepository") {
  static readonly layer: Layer.Layer<DashboardOverviewRepository, never, Database> = Layer.effect(
    DashboardOverviewRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return DashboardOverviewRepository.of({
        getResources: Effect.fn("database.dashboardOverviewRepository.getResources")(function* (
          organizationId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const accountRows = yield* db
            .select({
              total: sql<number>`count(*)::int`,
              active: sql<number>`count(*) filter (where ${wallet.status} = 'active')::int`,
              withoutActiveSessionKeys: sql<number>`count(*) filter (
                  where ${wallet.status} = 'active'
                  and not exists (
                    select 1 from ${sessionKey}
                    where ${sessionKey.organizationId} = ${wallet.organizationId}
                    and ${sessionKey.walletId} = ${wallet.id}
                    and ${sessionKey.status} = 'active'
                  )
                )::int`,
            })
            .from(wallet)
            .where(eq(wallet.organizationId, organizationId));
          const sessionKeyRows = yield* db
            .select({
              total: sql<number>`count(*)::int`,
              active: sql<number>`count(*) filter (where ${sessionKey.status} = 'active')::int`,
            })
            .from(sessionKey)
            .where(eq(sessionKey.organizationId, organizationId));
          const accounts = accountRows[0];
          const keys = sessionKeyRows[0];

          return {
            accounts: {
              total: decodeCount(accounts?.total ?? 0),
              active: decodeCount(accounts?.active ?? 0),
              withoutActiveSessionKeys: decodeCount(accounts?.withoutActiveSessionKeys ?? 0),
            },
            sessionKeys: {
              total: decodeCount(keys?.total ?? 0),
              active: decodeCount(keys?.active ?? 0),
            },
          };
        }, mapRepositoryError),
        getActivity: Effect.fn("database.dashboardOverviewRepository.getActivity")(function* (
          organizationId,
          since,
        ) {
          const db = yield* transactionOrDatabase(database);
          const encodedSince = Schema.encodeSync(Schema.DateTimeUtcFromDate)(since);
          const executionDay = sql<string>`to_char(${execution.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
          const failedExecutionDay = sql<string>`to_char(${executionSubmission.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
          const signatureDay = sql<string>`to_char(${signatureOperation.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;

          const [executions, failedExecutions, signatures] = yield* Effect.all(
            [
              db
                .select({
                  namespace: execution.namespace,
                  date: executionDay,
                  count: sql<number>`count(*)::int`,
                })
                .from(execution)
                .where(
                  and(
                    eq(execution.organizationId, organizationId),
                    gte(execution.createdAt, encodedSince),
                  ),
                )
                .groupBy(execution.namespace, executionDay),
              db
                .select({
                  namespace: executionSubmission.namespace,
                  date: failedExecutionDay,
                  count: sql<number>`count(*)::int`,
                })
                .from(executionSubmission)
                .where(
                  and(
                    eq(executionSubmission.organizationId, organizationId),
                    eq(executionSubmission.status, "failed"),
                    gte(executionSubmission.createdAt, encodedSince),
                  ),
                )
                .groupBy(executionSubmission.namespace, failedExecutionDay),
              db
                .select({
                  namespace: signatureOperation.namespace,
                  date: signatureDay,
                  count: sql<number>`count(*)::int`,
                })
                .from(signatureOperation)
                .where(
                  and(
                    eq(signatureOperation.organizationId, organizationId),
                    eq(signatureOperation.status, "succeeded"),
                    gte(signatureOperation.createdAt, encodedSince),
                  ),
                )
                .groupBy(signatureOperation.namespace, signatureDay),
            ],
            { concurrency: "unbounded" },
          );

          return [
            ...executions.map((row) => ({
              namespace: row.namespace,
              date: row.date,
              operation: "execution" as const,
              count: decodeCount(row.count),
            })),
            ...failedExecutions.map((row) => ({
              namespace: row.namespace,
              date: row.date,
              operation: "failed-execution" as const,
              count: decodeCount(row.count),
            })),
            ...signatures.map((row) => ({
              namespace: row.namespace,
              date: row.date,
              operation: "signature" as const,
              count: decodeCount(row.count),
            })),
          ];
        }, mapRepositoryError),
      });
    }),
  );
}
