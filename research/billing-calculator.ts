// Run: bun research/billing-calculator.ts
// Research only: does not change Namera entitlements, contact vendors, or write files.
// oxlint-disable no-console
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Plan = {
  name: string;
  monthlyPrice: number;
  organizations: number;
  members: number;
  selfOwnedAccounts: number;
  oneClawAccounts: number;
  oneClawSessionKeys: number;
  mainnetExecutions: number;
  testnetExecutions: number;
  signatures: number;
  sponsoredGasUsd: number;
};

// Illustrative plans and customer mix, not approved commercial terms.
// Resource allowances are concurrent counts; operations/gas reset monthly.
// Gas allowance means the complete vendor invoice, including its admin fee.
export const PLANS: readonly Plan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    organizations: 100,
    members: 5,
    selfOwnedAccounts: 50,
    oneClawAccounts: 5,
    oneClawSessionKeys: 5,
    mainnetExecutions: 100,
    testnetExecutions: 1_000,
    signatures: 1_000,
    sponsoredGasUsd: 0,
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    organizations: 10,
    members: 20,
    selfOwnedAccounts: 200,
    oneClawAccounts: 20,
    oneClawSessionKeys: 50,
    mainnetExecutions: 2_000,
    testnetExecutions: 10_000,
    signatures: 10_000,
    sponsoredGasUsd: 5,
  },
  {
    name: "Business",
    monthlyPrice: 249,
    organizations: 2,
    members: 100,
    selfOwnedAccounts: 1_000,
    oneClawAccounts: 100,
    oneClawSessionKeys: 250,
    mainnetExecutions: 10_000,
    testnetExecutions: 50_000,
    signatures: 50_000,
    sponsoredGasUsd: 15,
  },
  {
    name: "Enterprise",
    monthlyPrice: 999,
    organizations: 1,
    members: 250,
    selfOwnedAccounts: 5_000,
    oneClawAccounts: 500,
    oneClawSessionKeys: 1_000,
    mainnetExecutions: 50_000,
    testnetExecutions: 100_000,
    signatures: 250_000,
    sponsoredGasUsd: 50,
  },
];

type PooledRate = { included: number | null; overageUsd: number | null };
export type Costs = {
  alchemyUsdPerMillionCu: number;
  alchemyMonthlyUsd: number;
  alchemyIncludedCu: number;
  executionCu: number;
  portfolioRequestCu: number;
  gasAdminRate: number;
  oneClawMonthlyUsd: number | null;
  oneClawAgents: PooledRate;
  oneClawWallets: PooledRate;
  oneClawSignatures: PooledRate;
  oneClawApiCalls: PooledRate;
  emailMonthlyUsd: number;
  emailIncluded: number;
  emailBlockSize: number;
  emailBlockUsd: number;
  paymentRate: number;
  billingRate: number;
  currencyConversionRate: number;
  paymentFixedUsd: number;
  hostingMonthlyUsd: number | null;
  databaseMonthlyUsd: number | null;
  observabilityMonthlyUsd: number | null;
  otherMonthlyUsd: number | null;
};

// Published reference rates checked 2026-10-10; replace with your own agreement.
// https://www.alchemy.com/pricing (PAYG: no assumed Free-plan CU deduction)
// https://www.alchemy.com/docs/reference/compute-unit-costs
// https://resend.com/pricing?volume=50000 (Pro; overage billed in 1,000-email blocks)
// https://stripe.com/in/pricing and https://stripe.com/in/billing/pricing
// Stripe defaults below are an illustrative India/international scenario, not verified for Namera.
// null means UNKNOWN, not free. Set an explicit 0 only when confirmed to be free.
// For unlimited contract allowances use included: Infinity, overageUsd: 0.
// 1Claw quotas are pooled across the entire customer mix, never repeated per organization.
export const COSTS: Costs = {
  alchemyUsdPerMillionCu: 0.525,
  alchemyMonthlyUsd: 0,
  alchemyIncludedCu: 0,
  executionCu: 3_850, // Estimated complete BSO lifecycle, not a measured guarantee.
  portfolioRequestCu: 360,
  gasAdminRate: 0.08,
  oneClawMonthlyUsd: null,
  oneClawAgents: { included: null, overageUsd: null },
  oneClawWallets: { included: null, overageUsd: null },
  oneClawSignatures: { included: null, overageUsd: null },
  oneClawApiCalls: { included: null, overageUsd: null },
  emailMonthlyUsd: 20,
  emailIncluded: 50_000,
  emailBlockSize: 1_000,
  emailBlockUsd: 0.9,
  paymentRate: 0.043,
  billingRate: 0.007,
  currencyConversionRate: 0,
  paymentFixedUsd: 0,
  hostingMonthlyUsd: null,
  databaseMonthlyUsd: null,
  observabilityMonthlyUsd: null,
  otherMonthlyUsd: null, // Egress, registry, ENS, support, etc.; avoid double-counting hosting.
};

export const ASSUMPTIONS = {
  targetMargin: 0.7,
  managedExecutionShare: 1, // 0 for local-session execution, 1 when every execution needs 1Claw.
  managedSignatureShare: 1,
  signingAttemptsPerOperation: 1, // Increase for replacements/retries charged by the provider.
  setupSignaturesPerNewKey: 0,
  newKeysFractionPerMonth: 0.1,
  apiCallsPerSignature: 3, // Token exchange + key read + signing in the current adapter.
  apiCallsPerNewKey: 6, // Planning estimate; replace with measured request counts.
  orgSetupApiCallsPerMonth: 0, // Extra onboarding, renewal and reconciliation calls per org.
  portfolioRequestsPerAccountPerMonth: 30,
  emailsPerMemberPerMonth: 10,
  extraCuPerOrgPerMonth: 0, // RPC proxy, extra polling, simulations, failed preparations, etc.
};
export type Assumptions = typeof ASSUMPTIONS;

export const SCENARIOS = [
  { name: "25% monthly usage", usage: 0.25 },
  { name: "100% included usage", usage: 1 },
] as const;

const nonNegative = (name: string, value: number) => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be finite and non-negative`);
};

const allocate = (cost: number, quantity: number, pooledQuantity: number) =>
  pooledQuantity === 0 ? 0 : (cost * quantity) / pooledQuantity;

export function validate(
  plans: readonly Plan[],
  costs: Costs,
  assumptions: Assumptions,
  usage: number,
) {
  for (const plan of plans) {
    if (!plan.name.trim()) throw new Error("Plan name must not be empty");
    for (const [key, value] of Object.entries(plan)) {
      if (typeof value === "number") nonNegative(`${plan.name}.${key}`, value);
      if (
        typeof value === "number" &&
        !["monthlyPrice", "sponsoredGasUsd"].includes(key) &&
        !Number.isInteger(value)
      ) {
        throw new Error(`${plan.name}.${key} must be an integer`);
      }
    }
  }
  if (!plans.length || new Set(plans.map((plan) => plan.name)).size !== plans.length)
    throw new Error("Plan names must be unique and nonempty");
  for (const [key, value] of Object.entries(costs)) {
    if (value === null) continue;
    if (typeof value === "number") nonNegative(key, value);
    else {
      if (value.included !== null && value.included !== Infinity)
        nonNegative(`${key}.included`, value.included);
      if (value.overageUsd !== null) nonNegative(`${key}.overageUsd`, value.overageUsd);
    }
  }
  for (const [key, value] of Object.entries(assumptions)) nonNegative(key, value);
  for (const [key, value] of Object.entries({
    usage,
    managedExecutionShare: assumptions.managedExecutionShare,
    managedSignatureShare: assumptions.managedSignatureShare,
    newKeysFractionPerMonth: assumptions.newKeysFractionPerMonth,
  })) {
    nonNegative(key, value);
    if (value > 1) throw new Error(`${key} must be between 0 and 1`);
  }
  const fees = costs.paymentRate + costs.billingRate + costs.currencyConversionRate;
  if (
    costs.emailBlockSize <= 0 ||
    costs.gasAdminRate > 1 ||
    fees >= 1 ||
    assumptions.targetMargin + fees >= 1
  ) {
    throw new Error("Invalid block size, fee rate, or unattainable target margin");
  }
  if (assumptions.signingAttemptsPerOperation < 1)
    throw new Error("Signing attempts must be at least 1");
  if (!plans.some((plan) => plan.organizations > 0))
    throw new Error("At least one organization is required");
}

export function forecast(
  plans: readonly Plan[],
  costs: Costs,
  assumptions: Assumptions,
  usage: number,
) {
  validate(plans, costs, assumptions, usage);
  const warnings = new Set<string>();
  const known = (name: string, value: number | null) => {
    if (value === null) warnings.add(`${name} is unknown and excluded`);
    return value ?? 0;
  };
  const demand = plans.map((plan) => {
    // All allocated resources remain present even when operation utilization falls.
    const keys = plan.oneClawAccounts + plan.oneClawSessionKeys;
    const executions = (plan.mainnetExecutions + plan.testnetExecutions) * usage;
    const newKeys = keys * assumptions.newKeysFractionPerMonth;
    const signatures =
      (executions * assumptions.managedExecutionShare +
        plan.signatures * usage * assumptions.managedSignatureShare) *
        assumptions.signingAttemptsPerOperation +
      newKeys * assumptions.setupSignaturesPerNewKey;
    const accounts = plan.selfOwnedAccounts + plan.oneClawAccounts;
    return {
      plan,
      keys,
      signatures,
      apiCalls:
        signatures * assumptions.apiCallsPerSignature +
        newKeys * assumptions.apiCallsPerNewKey +
        assumptions.orgSetupApiCallsPerMonth,
      cu:
        executions * costs.executionCu +
        accounts *
          assumptions.portfolioRequestsPerAccountPerMonth *
          usage *
          costs.portfolioRequestCu +
        assumptions.extraCuPerOrgPerMonth,
      emails: plan.members * assumptions.emailsPerMemberPerMonth * usage,
    };
  });
  const total = (field: "keys" | "signatures" | "apiCalls" | "cu" | "emails") =>
    demand.reduce((sum, row) => sum + row[field] * row.plan.organizations, 0);
  const orgs = plans.reduce((sum, plan) => sum + plan.organizations, 0);
  const totals = {
    keys: total("keys"),
    signatures: total("signatures"),
    apiCalls: total("apiCalls"),
    cu: total("cu"),
    emails: total("emails"),
  };
  const pooled = (name: string, quantity: number, rate: PooledRate) => {
    if (quantity === 0) return 0;
    if (rate.included === null) {
      warnings.add(`${name} allowance is unknown; overage excluded`);
      return 0;
    }
    const excess = Math.max(0, quantity - rate.included);
    return excess === 0 ? 0 : excess * known(`${name} overage rate`, rate.overageUsd);
  };
  const keyCost =
    pooled("1Claw agents", totals.keys, costs.oneClawAgents) +
    pooled("1Claw wallets", totals.keys, costs.oneClawWallets);
  const signatureCost = pooled("1Claw signatures", totals.signatures, costs.oneClawSignatures);
  const apiCost = pooled("1Claw API calls", totals.apiCalls, costs.oneClawApiCalls);
  const clawBase = known("1Claw monthly commitment", costs.oneClawMonthlyUsd);
  const overhead =
    known("Hosting", costs.hostingMonthlyUsd) +
    known("Database", costs.databaseMonthlyUsd) +
    known("Observability", costs.observabilityMonthlyUsd) +
    known("Other monthly costs", costs.otherMonthlyUsd);
  const alchemyVariable =
    (Math.max(0, totals.cu - costs.alchemyIncludedCu) * costs.alchemyUsdPerMillionCu) / 1_000_000;
  const emailVariable =
    Math.ceil(Math.max(0, totals.emails - costs.emailIncluded) / costs.emailBlockSize) *
    costs.emailBlockUsd;
  const feeRate = costs.paymentRate + costs.billingRate + costs.currencyConversionRate;
  const rows = demand.map((row) => {
    const alchemy = costs.alchemyMonthlyUsd / orgs + allocate(alchemyVariable, row.cu, totals.cu);
    const oneClaw =
      clawBase / orgs +
      allocate(keyCost, row.keys, totals.keys) +
      allocate(signatureCost, row.signatures, totals.signatures) +
      allocate(apiCost, row.apiCalls, totals.apiCalls);
    const email = costs.emailMonthlyUsd / orgs + allocate(emailVariable, row.emails, totals.emails);
    const gas = row.plan.sponsoredGasUsd * usage;
    const fixed = overhead / orgs;
    const beforePayments = alchemy + oneClaw + email + gas + fixed;
    const payments =
      row.plan.monthlyPrice === 0 ? 0 : row.plan.monthlyPrice * feeRate + costs.paymentFixedUsd;
    const cost = beforePayments + payments;
    const profit = row.plan.monthlyPrice - cost;
    return {
      plan: row.plan,
      alchemy,
      oneClaw,
      email,
      gas,
      rawGas: gas / (1 + costs.gasAdminRate),
      overhead: fixed,
      payments,
      cost,
      profit,
      margin: row.plan.monthlyPrice === 0 ? null : profit / row.plan.monthlyPrice,
      breakEvenPrice: (beforePayments + costs.paymentFixedUsd) / (1 - feeRate),
      targetPrice:
        (beforePayments + costs.paymentFixedUsd) / (1 - feeRate - assumptions.targetMargin),
    };
  });
  const revenue = rows.reduce(
    (sum, row) => sum + row.plan.monthlyPrice * row.plan.organizations,
    0,
  );
  const cost = rows.reduce((sum, row) => sum + row.cost * row.plan.organizations, 0);
  return {
    rows,
    totals,
    warnings: [...warnings],
    revenue,
    cost,
    profit: revenue - cost,
    margin: revenue === 0 ? null : (revenue - cost) / revenue,
  };
}

const usd = (value: number) => `$${value.toFixed(2)}`;
const percent = (value: number | null) =>
  value === null ? "N/A (free)" : `${(value * 100).toFixed(1)}%`;

function main() {
  console.log(
    "Namera monthly pricing sandbox (USD)\nEdit PLANS, COSTS, ASSUMPTIONS and SCENARIOS at the top. No env or network calls.",
  );
  console.log(
    "All plan prices, quotas, customer counts and utilization are editable examples. Enterprise pricing is a placeholder, not a quote.",
  );
  console.table(PLANS);
  console.log("Cost inputs (null = unknown, not free):");
  console.log(COSTS);
  console.log("Workload assumptions:");
  console.log(ASSUMPTIONS);
  for (const scenario of SCENARIOS) {
    const report = forecast(PLANS, COSTS, ASSUMPTIONS, scenario.usage);
    const partial = report.warnings.length > 0;
    console.log(
      `\n${scenario.name}: ${partial ? "PARTIAL COSTS / OPTIMISTIC MARGINS" : "MODELED COSTS / ESTIMATED MARGINS"}`,
    );
    for (const warning of report.warnings) console.log(`  WARNING: ${warning}`);
    console.log(
      "Per organization/month; shared fixed costs split equally across the configured customer mix.",
    );
    console.table(
      report.rows
        .filter((row) => row.plan.organizations > 0)
        .map((row) => ({
          Plan: row.plan.name,
          Price: usd(row.plan.monthlyPrice),
          Alchemy: usd(row.alchemy),
          "1Claw": usd(row.oneClaw),
          Email: usd(row.email),
          Gas: usd(row.gas),
          Overhead: usd(row.overhead),
          Payments: usd(row.payments),
          "Known cost": usd(row.cost),
          "Revenue - known cost": usd(row.profit),
          "Margin*": percent(row.margin),
          "Break-even*": usd(row.breakEvenPrice),
          "Target price*": usd(row.targetPrice),
        })),
    );
    console.log(
      `Fleet: revenue ${usd(report.revenue)}, known costs ${usd(report.cost)}, remainder ${usd(report.profit)}, margin ${percent(report.margin)}.`,
    );
    console.log(
      `Fleet demand: ${Math.ceil(report.totals.keys)} agents and wallets, ${Math.ceil(report.totals.signatures)} provider signatures, ${Math.ceil(report.totals.apiCalls)} provider API calls, ${Math.ceil(report.totals.cu)} CU, ${Math.ceil(report.totals.emails)} emails.`,
    );
    console.log(
      `* Target margin ${(ASSUMPTIONS.targetMargin * 100).toFixed(0)}%; prices assume the same mix/usage. ${partial ? "Unknown costs excluded: these are NOT final profit or break-even figures." : "Model estimates, not guaranteed profit."}`,
    );
  }
  console.log(
    "\nNo customer overage revenue, annual discounts, taxes, refunds or disputes modeled. Fixed subscriptions plus pooled overages assume additive vendor pricing; adjust for minimum-spend contracts. Free customers consume shared allowances too. Zero-count plans are excluded from results. No automatic provider key deletion is assumed.",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
