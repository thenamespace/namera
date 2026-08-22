import { Schema } from "effect";

import { GetDashboardOverviewResponse, ListExecutionsResponse } from "@namera-ai/protocol/dto";

const points = (values: ReadonlyArray<readonly [string, number, number]>) =>
  values.map(([date, executions, signatures]) => ({ date, executions, signatures }));

export const dashboardOverviewPreview = Schema.decodeSync(GetDashboardOverviewResponse)({
  organizationId: "01900000-0000-7000-8000-000000000001",
  resources: {
    accounts: { total: 5, active: 4 },
    sessionKeys: { total: 11, active: 8 },
  },
  namespaces: [
    {
      namespace: "eip155",
      totals: { executions: "511", signatures: "724" },
      executionSources: [
        { actorType: "mcp", count: 314 },
        { actorType: "api-key", count: 129 },
        { actorType: "cli", count: 68 },
      ],
      activity: {
        daily: {
          granularity: "day",
          points: points([
            ["2026-08-09", 17, 34],
            ["2026-08-10", 14, 29],
            ["2026-08-11", 18, 37],
            ["2026-08-12", 16, 33],
            ["2026-08-13", 20, 41],
            ["2026-08-14", 19, 39],
            ["2026-08-15", 23, 46],
            ["2026-08-16", 17, 35],
            ["2026-08-17", 25, 49],
            ["2026-08-18", 22, 44],
            ["2026-08-19", 27, 52],
            ["2026-08-20", 24, 48],
            ["2026-08-21", 29, 57],
            ["2026-08-22", 18, 36],
          ]),
        },
        weekly: {
          granularity: "week",
          points: points([
            ["2026-06-01", 31, 62],
            ["2026-06-08", 38, 74],
            ["2026-06-15", 45, 83],
            ["2026-06-22", 41, 79],
            ["2026-06-29", 52, 94],
            ["2026-07-06", 56, 108],
            ["2026-07-13", 63, 119],
            ["2026-07-20", 59, 111],
            ["2026-07-27", 71, 132],
            ["2026-08-03", 86, 154],
            ["2026-08-10", 145, 286],
            ["2026-08-17", 18, 36],
          ]),
        },
        monthly: {
          granularity: "month",
          points: points([
            ["2025-09-01", 92, 136],
            ["2025-10-01", 108, 159],
            ["2025-11-01", 121, 183],
            ["2025-12-01", 116, 177],
            ["2026-01-01", 149, 224],
            ["2026-02-01", 172, 251],
            ["2026-03-01", 198, 289],
            ["2026-04-01", 216, 318],
            ["2026-05-01", 248, 362],
            ["2026-06-01", 279, 411],
            ["2026-07-01", 334, 497],
            ["2026-08-01", 511, 724],
          ]),
        },
      },
    },
  ],
});

const transactionHash = (character: string): `0x${string}` => `0x${character.repeat(64)}`;

export const dashboardExecutionsPreview = Schema.decodeSync(ListExecutionsResponse)({
  nextCursor: null,
  items: [
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
});
