import { Schema } from "effect";

import { GetDashboardOverviewResponse } from "@namera-ai/protocol/dto";

const activity = [
  ["2026-07-24", 3, 0, 8],
  ["2026-07-25", 4, 0, 11],
  ["2026-07-26", 2, 1, 7],
  ["2026-07-27", 7, 0, 14],
  ["2026-07-28", 8, 0, 18],
  ["2026-07-29", 5, 0, 12],
  ["2026-07-30", 9, 1, 20],
  ["2026-07-31", 6, 0, 16],
  ["2026-08-01", 11, 0, 22],
  ["2026-08-02", 7, 0, 17],
  ["2026-08-03", 10, 0, 24],
  ["2026-08-04", 13, 1, 27],
  ["2026-08-05", 9, 0, 19],
  ["2026-08-06", 12, 0, 28],
  ["2026-08-07", 15, 0, 31],
  ["2026-08-08", 11, 0, 26],
  ["2026-08-09", 17, 1, 34],
  ["2026-08-10", 14, 0, 29],
  ["2026-08-11", 18, 0, 37],
  ["2026-08-12", 16, 0, 33],
  ["2026-08-13", 20, 1, 41],
  ["2026-08-14", 19, 0, 39],
  ["2026-08-15", 23, 0, 46],
  ["2026-08-16", 17, 0, 35],
  ["2026-08-17", 25, 1, 49],
  ["2026-08-18", 22, 0, 44],
  ["2026-08-19", 27, 0, 52],
  ["2026-08-20", 24, 0, 48],
  ["2026-08-21", 29, 1, 57],
  ["2026-08-22", 18, 0, 36],
] as const;

const transactionHash = (character: string): `0x${string}` => `0x${character.repeat(64)}`;

export const dashboardOverviewPreview = Schema.decodeSync(GetDashboardOverviewResponse)({
  organizationId: "01900000-0000-7000-8000-000000000001",
  period: {
    startsAt: new Date("2026-08-06T09:30:00.000Z"),
    endsAt: new Date("2026-09-06T09:30:00.000Z"),
  },
  resources: {
    accounts: { total: 5, active: 4, included: 5, withoutActiveSessionKeys: 1 },
    sessionKeys: { total: 11, active: 8 },
  },
  namespaces: [
    {
      namespace: "eip155",
      usage: {
        mainnetExecutions: { consumedAmount: "67", reservedAmount: "2", limitAmount: "100" },
        testnetExecutions: {
          consumedAmount: "438",
          reservedAmount: "4",
          limitAmount: "1000",
        },
        signatures: { consumedAmount: "724", reservedAmount: "3", limitAmount: "10000" },
        sponsoredGasMicroUsd: {
          consumedAmount: "1840000",
          reservedAmount: "90000",
          limitAmount: "3000000",
        },
      },
      activity: {
        windowDays: 30,
        series: activity.map(([date, executions, failedExecutions, signatures]) => ({
          date,
          executions,
          failedExecutions,
          signatures,
        })),
      },
    },
  ],
  recentExecutions: [
    {
      details: {
        id: "01900000-0000-7000-8000-000000000011",
        namespace: "eip155",
        chainId: "eip155:8453",
        transactionHash: transactionHash("a"),
        createdAt: new Date("2026-08-22T10:18:00.000Z"),
      },
      wallet: {
        id: "01900000-0000-7000-8000-000000000021",
        namespace: "eip155",
        address: "0xc0d86456F6f2930b892f3DAD007CDBE32c081FE6",
        metadata: { version: 1, name: "Treasury" },
      },
      sessionKey: {
        id: "01900000-0000-7000-8000-000000000031",
        namespace: "eip155",
        metadata: { version: 1, name: "Payments agent" },
      },
      actorType: "mcp",
    },
    {
      details: {
        id: "01900000-0000-7000-8000-000000000012",
        namespace: "eip155",
        chainId: "eip155:1",
        transactionHash: transactionHash("b"),
        createdAt: new Date("2026-08-22T08:42:00.000Z"),
      },
      wallet: {
        id: "01900000-0000-7000-8000-000000000022",
        namespace: "eip155",
        address: "0x1111111111111111111111111111111111111111",
        metadata: { version: 1, name: "Operations" },
      },
      sessionKey: {
        id: "01900000-0000-7000-8000-000000000032",
        namespace: "eip155",
        metadata: { version: 1, name: "Settlement worker" },
      },
      actorType: "api-key",
    },
    {
      details: {
        id: "01900000-0000-7000-8000-000000000013",
        namespace: "eip155",
        chainId: "eip155:42161",
        transactionHash: transactionHash("c"),
        createdAt: new Date("2026-08-21T18:05:00.000Z"),
      },
      wallet: {
        id: "01900000-0000-7000-8000-000000000023",
        namespace: "eip155",
        address: "0x2222222222222222222222222222222222222222",
        metadata: { version: 1, name: "Rewards" },
      },
      sessionKey: {
        id: "01900000-0000-7000-8000-000000000033",
        namespace: "eip155",
        metadata: { version: 1, name: "Distribution CLI" },
      },
      actorType: "cli",
    },
  ],
  attention: [
    {
      code: "accounts-without-session-keys",
      severity: "info",
      count: 1,
      message: "1 active account has no active session key.",
      href: "/accounts",
    },
  ],
});
