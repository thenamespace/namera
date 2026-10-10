import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ASSUMPTIONS,
  COSTS,
  PLANS,
  forecast,
  type Costs,
  type Plan,
} from "./billing-calculator.ts";

const plan: Plan = {
  name: "Test",
  monthlyPrice: 100,
  organizations: 1,
  members: 0,
  selfOwnedAccounts: 0,
  oneClawAccounts: 0,
  oneClawSessionKeys: 0,
  mainnetExecutions: 0,
  testnetExecutions: 0,
  signatures: 0,
  sponsoredGasUsd: 0,
};
const costs: Costs = {
  ...COSTS,
  alchemyUsdPerMillionCu: 0,
  alchemyMonthlyUsd: 0,
  oneClawMonthlyUsd: 0,
  oneClawAgents: { included: 0, overageUsd: 0 },
  oneClawWallets: { included: 0, overageUsd: 0 },
  oneClawSignatures: { included: 0, overageUsd: 0 },
  oneClawApiCalls: { included: 0, overageUsd: 0 },
  emailMonthlyUsd: 0,
  emailBlockUsd: 0,
  paymentRate: 0,
  billingRate: 0,
  currencyConversionRate: 0,
  paymentFixedUsd: 0,
  hostingMonthlyUsd: 0,
  databaseMonthlyUsd: 0,
  observabilityMonthlyUsd: 0,
  otherMonthlyUsd: 0,
};
const assumptions = {
  ...ASSUMPTIONS,
  newKeysFractionPerMonth: 0,
  portfolioRequestsPerAccountPerMonth: 0,
  emailsPerMemberPerMonth: 0,
};
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("unknown costs produce explicit partial-cost warnings", () => {
  const result = forecast(PLANS, COSTS, ASSUMPTIONS, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("1Claw monthly")));
  assert.ok(result.warnings.some((warning) => warning.includes("Hosting")));
  assert.ok(result.warnings.some((warning) => warning.includes("allowance")));
});

test("vendor allowances are pooled once, including Free customers", () => {
  const result = forecast(
    [
      { ...plan, name: "Free", monthlyPrice: 0, organizations: 2, signatures: 100 },
      { ...plan, name: "Paid", signatures: 100 },
    ],
    { ...costs, oneClawMonthlyUsd: 30, oneClawSignatures: { included: 100, overageUsd: 0.1 } },
    assumptions,
    1,
  );
  assert.equal(result.totals.signatures, 300);
  close(result.cost, 50);
  const row = result.rows[0];
  assert.ok(row);
  close(row.oneClaw, 50 / 3);
  assert.equal(row.margin, null);
  assert.equal(result.revenue, 100);
});

test("counts both managed roots and sessions; lower usage does not remove key costs", () => {
  const result = forecast(
    [{ ...plan, oneClawAccounts: 2, oneClawSessionKeys: 3 }],
    {
      ...costs,
      oneClawAgents: { included: 0, overageUsd: 2 },
      oneClawWallets: { included: 0, overageUsd: 1 },
    },
    assumptions,
    0,
  );
  assert.equal(result.totals.keys, 5);
  assert.equal(result.cost, 15);
});

test("gas budget includes vendor admin fee, not an extra markup", () => {
  const result = forecast([{ ...plan, sponsoredGasUsd: 10.8 }], costs, assumptions, 0.5);
  const row = result.rows[0];
  assert.ok(row);
  close(row.gas, 5.4);
  close(row.rawGas, 5);
});

test("paid processing, break-even and target price use the same fee model", () => {
  const result = forecast(
    [plan],
    { ...costs, hostingMonthlyUsd: 20, paymentRate: 0.05, paymentFixedUsd: 0.3 },
    assumptions,
    1,
  );
  close(result.cost, 25.3);
  close(result.profit, 74.7);
  const row = result.rows[0];
  assert.ok(row);
  close(row.breakEvenPrice, 20.3 / 0.95);
  close(row.targetPrice, 20.3 / (0.95 - assumptions.targetMargin));
});

test("email overages round up pooled blocks and charge the base once", () => {
  const result = forecast(
    [{ ...plan, organizations: 2, members: 1 }],
    {
      ...costs,
      emailMonthlyUsd: 20,
      emailIncluded: 50_000,
      emailBlockUsd: 0.9,
    },
    { ...assumptions, emailsPerMemberPerMonth: 25_001 },
    1,
  );
  close(result.cost, 20.9);
});

test("local signing has no provider-signing cost but retains Alchemy compute", () => {
  const result = forecast(
    [{ ...plan, mainnetExecutions: 100, testnetExecutions: 100, signatures: 100 }],
    {
      ...costs,
      alchemyUsdPerMillionCu: 0.525,
    },
    { ...assumptions, managedExecutionShare: 0, managedSignatureShare: 0 },
    1,
  );
  assert.equal(result.totals.signatures, 0);
  close(result.cost, (200 * 3_850 * 0.525) / 1_000_000);
});

test("zero-count plans consume no allowances or revenue; unlimited quotas have no overage", () => {
  const result = forecast(
    [plan, { ...plan, name: "Unused", organizations: 0, signatures: 1_000_000 }],
    {
      ...costs,
      oneClawSignatures: { included: Infinity, overageUsd: 0 },
    },
    assumptions,
    1,
  );
  assert.equal(result.totals.signatures, 0);
  assert.equal(result.revenue, 100);
  assert.equal(result.cost, 0);
});

test("invalid numeric inputs and impossible margins fail instead of printing misleading results", () => {
  assert.throws(() => forecast([{ ...plan, organizations: 0 }], costs, assumptions, 1));
  assert.throws(() => forecast([{ ...plan, monthlyPrice: -1 }], costs, assumptions, 1));
  assert.throws(() => forecast([plan], { ...costs, emailBlockSize: 0 }, assumptions, 1));
  assert.throws(() => forecast([plan], costs, { ...assumptions, targetMargin: 1 }, 1));
  assert.throws(() => forecast([plan], costs, assumptions, NaN));
  assert.throws(() => forecast([plan], costs, assumptions, 2));
});
