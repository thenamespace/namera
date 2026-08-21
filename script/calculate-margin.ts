// oxlint-disable no-console

// @ts-expect-error safe
import { writeFileSync } from "node:fs";
// @ts-expect-error safe
import { stripVTControlCharacters } from "node:util";

type OveragePrice = {
  /** Number of operations sold as one customer-facing overage block. */
  readonly operations: number;
  /** USD charged for one complete overage block. */
  readonly price: number;
};

type Plan = {
  /** Public plan name displayed in the report. */
  readonly name: string;
  /** Fixed monthly subscription revenue in USD. Use 0 for a free plan. */
  readonly monthlyPrice: number;
  /** Maximum organization members included in the plan. */
  readonly members: number;
  /** Maximum active software-backed wallets included in the plan. */
  readonly softwareWallets: number;
  /** Maximum active GCP HSM-backed wallets included in the plan. */
  readonly hsmWallets: number;
  /** Successful logical executions included in each monthly billing period. */
  readonly includedExecutions: number;
  /** Customer-facing execution overage block. Null means a hard cap. */
  readonly executionOverage: OveragePrice | null;
  /** Successful wallet signatures included in each monthly billing period. */
  readonly includedSignatures: number;
  /** Customer-facing signature overage block. Null means a hard cap. */
  readonly signatureOverage: OveragePrice | null;
  /** Maximum Pimlico gas invoice Namera funds during the period. */
  readonly includedSponsoredGasUsd: number;
  /** Fraction of executions signed with HSM keys, from 0 (none) to 1 (all). */
  readonly hsmExecutionShare: number;
  /** Fraction of signature operations signed with HSM keys, from 0 (none) to 1 (all). */
  readonly hsmSignatureShare: number;
};

type VendorPricing = {
  readonly pimlico: {
    /** Credits shared by the complete Pimlico account each month. */
    readonly includedCreditsPerMonth: number;
    /** Size of one purchasable block of additional Pimlico credits. */
    readonly additionalCredits: number;
    /** USD price of one additional-credit block. */
    readonly additionalCreditsPrice: number;
    /** Estimated total Pimlico credits consumed by a standard UserOperation. */
    readonly standardUserOperationCredits: number;
    /** Estimated total Pimlico credits consumed by a sponsored UserOperation. */
    readonly sponsoredUserOperationCredits: number;
    /** Pimlico surcharge applied to the raw mainnet gas it sponsors. */
    readonly sponsoredGasSurchargeRate: number;
  };
  readonly alchemy: {
    /** Compute units shared by the complete Alchemy account for free each month. */
    readonly includedComputeUnitsPerMonth: number;
    /** Monthly CU boundary after which Alchemy's volume rate starts. */
    readonly firstTierComputeUnits: number;
    /** USD charged per million CUs before the volume boundary. */
    readonly firstTierPricePerMillion: number;
    /** USD charged per million CUs after the volume boundary. */
    readonly volumePricePerMillion: number;
  };
  readonly gcp: {
    /** USD per active software EC key version for a full month. */
    readonly softwareKeyVersionPerMonth: number;
    /** USD per active HSM EC key version for a full month. */
    readonly hsmKeyVersionPerMonth: number;
    /** Number of software cryptographic operations in one priced block. */
    readonly softwareOperations: number;
    /** USD price of one software-operation block. */
    readonly softwareOperationsPrice: number;
    /** Number of HSM cryptographic operations in one priced block. */
    readonly hsmOperations: number;
    /** USD price of one HSM-operation block. */
    readonly hsmOperationsPrice: number;
  };
  readonly resend: {
    /** Transactional emails shared by the complete Resend account for free each month. */
    readonly freeEmailsPerMonth: number;
    /** USD monthly price of the selected paid Resend plan. */
    readonly paidPlanPrice: number;
    /** Emails included in the selected paid Resend plan. */
    readonly paidPlanEmails: number;
    /** Number of emails in one Resend overage block. */
    readonly overageEmails: number;
    /** USD price of one Resend overage block. */
    readonly overagePrice: number;
  };
  readonly stripe: {
    /** Stripe Billing fee as a decimal, for example 0.007 for 0.7%. */
    readonly billingRate: number;
    /** Expected payment-processing fee as a decimal. */
    readonly paymentRate: number;
    /** Expected currency-conversion fee as a decimal. Keep 0 when not applicable. */
    readonly currencyConversionRate: number;
  };
};

type MarginAssumptions = {
  /** Estimated Alchemy compute units consumed by one logical execution. */
  readonly alchemyComputeUnitsPerExecution: number;
  /** Estimated transactional emails sent for each member every month. */
  readonly emailsPerMemberPerMonth: number;
  /** USD monthly price charged for one additional active HSM wallet. */
  readonly additionalHsmWalletPrice: number;
  /** Markup on Pimlico's complete sponsored-gas invoice, expressed as a decimal. */
  readonly sponsoredGasCustomerMarkupRate: number;
  /** Raw gas costs in USD used to render sponsorship sensitivity examples. */
  readonly sponsoredGasExamples: ReadonlyArray<number>;
  /** Desired contribution-margin interval for paid plans at full included usage. */
  readonly targetPaidMargin: {
    readonly minimum: number;
    readonly maximum: number;
  };
};

type CellAlignment = "left" | "right";

type Column = {
  readonly header: string;
  readonly align?: CellAlignment;
};

type PlanCosts = {
  readonly pimlico: number;
  readonly alchemy: number;
  readonly gcpKeys: number;
  readonly executionSigning: number;
  readonly signatureSigning: number;
  readonly sponsoredGas: number;
  readonly resend: number;
  readonly stripe: number;
};

// Edit these values when Namera's plans or vendor prices change.
const plans: ReadonlyArray<Plan> = [
  {
    name: "Free",
    monthlyPrice: 0,
    members: 5,
    softwareWallets: 5,
    hsmWallets: 0,
    includedExecutions: 500,
    executionOverage: null,
    includedSignatures: 10_000,
    signatureOverage: null,
    includedSponsoredGasUsd: 3,
    hsmExecutionShare: 0,
    hsmSignatureShare: 0,
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    members: 20,
    softwareWallets: 20,
    hsmWallets: 1,
    includedExecutions: 2_000,
    executionOverage: { operations: 1_000, price: 20 },
    includedSignatures: 50_000,
    signatureOverage: { operations: 10_000, price: 1 },
    includedSponsoredGasUsd: 5,
    hsmExecutionShare: 1,
    hsmSignatureShare: 1,
  },
  {
    name: "Business",
    monthlyPrice: 249,
    members: 100,
    softwareWallets: 100,
    hsmWallets: 5,
    includedExecutions: 10_000,
    executionOverage: { operations: 1_000, price: 20 },
    includedSignatures: 250_000,
    signatureOverage: { operations: 10_000, price: 1 },
    includedSponsoredGasUsd: 15,
    hsmExecutionShare: 1,
    hsmSignatureShare: 1,
  },
];

const pricing = {
  pimlico: {
    includedCreditsPerMonth: 10_000_000,
    additionalCredits: 100_000,
    additionalCreditsPrice: 1,
    standardUserOperationCredits: 750,
    sponsoredUserOperationCredits: 1_050,
    sponsoredGasSurchargeRate: 0.1,
  },
  alchemy: {
    includedComputeUnitsPerMonth: 30_000_000,
    firstTierComputeUnits: 300_000_000,
    firstTierPricePerMillion: 0.45,
    volumePricePerMillion: 0.4,
  },
  gcp: {
    softwareKeyVersionPerMonth: 0.06,
    hsmKeyVersionPerMonth: 2.5,
    softwareOperations: 10_000,
    softwareOperationsPrice: 0.03,
    hsmOperations: 10_000,
    hsmOperationsPrice: 0.15,
  },
  resend: {
    freeEmailsPerMonth: 3_000,
    paidPlanPrice: 20,
    paidPlanEmails: 50_000,
    overageEmails: 1_000,
    overagePrice: 0.9,
  },
  stripe: {
    billingRate: 0.007,
    paymentRate: 0.043,
    currencyConversionRate: 0,
  },
} as const satisfies VendorPricing;

const assumptions = {
  alchemyComputeUnitsPerExecution: 500,
  emailsPerMemberPerMonth: 10,
  additionalHsmWalletPrice: 7,
  sponsoredGasCustomerMarkupRate: 0.25,
  sponsoredGasExamples: [0.001, 0.01, 0.1, 1, 10],
  targetPaidMargin: {
    minimum: 0.3,
    maximum: 0.5,
  },
} as const satisfies MarginAssumptions;

// @ts-expect-error safe to ignore
const colorsEnabled = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;

const ansi = {
  bold: (value: string) => (colorsEnabled ? `\u001B[1m${value}\u001B[22m` : value),
  cyan: (value: string) => (colorsEnabled ? `\u001B[36m${value}\u001B[39m` : value),
  dim: (value: string) => (colorsEnabled ? `\u001B[2m${value}\u001B[22m` : value),
  green: (value: string) => (colorsEnabled ? `\u001B[32m${value}\u001B[39m` : value),
  red: (value: string) => (colorsEnabled ? `\u001B[31m${value}\u001B[39m` : value),
  yellow: (value: string) => (colorsEnabled ? `\u001B[33m${value}\u001B[39m` : value),
};

const visibleLength = (value: string) => stripVTControlCharacters(value).length;

const pad = (value: string, width: number, alignment: CellAlignment) => {
  const padding = " ".repeat(Math.max(0, width - visibleLength(value)));
  return alignment === "right" ? `${padding}${value}` : `${value}${padding}`;
};

const renderTable = (
  columns: ReadonlyArray<Column>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
) => {
  const widths = columns.map((column, index) =>
    Math.max(visibleLength(column.header), ...rows.map((row) => visibleLength(row[index] ?? ""))),
  );
  const border = (left: string, middle: string, right: string, fill: string) =>
    `${left}${widths.map((width) => fill.repeat(width + 2)).join(middle)}${right}`;
  const renderRow = (row: ReadonlyArray<string>, header = false) =>
    `│${row
      .map((cell, index) => {
        const alignment = header ? "left" : (columns[index]?.align ?? "left");
        return ` ${pad(cell, widths[index] ?? 0, alignment)} `;
      })
      .join("│")}│`;

  return [
    border("┌", "┬", "┐", "─"),
    renderRow(
      columns.map((column) => ansi.bold(column.header)),
      true,
    ),
    border("├", "┼", "┤", "─"),
    ...rows.map((row) => renderRow(row)),
    border("└", "┴", "┘", "─"),
  ].join("\n");
};

const usd = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);

const integer = (value: number) => new Intl.NumberFormat("en-US").format(value);
const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;
const section = (title: string) => console.log(`\n${ansi.bold(ansi.cyan(title))}`);

const requireNonNegative = (name: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite, non-negative number`);
  }
};

const requireShare = (name: string, value: number) => {
  requireNonNegative(name, value);
  if (value > 1) throw new Error(`${name} must be between 0 and 1`);
};

const requireOverage = (name: string, overage: OveragePrice | null) => {
  if (overage === null) return;
  if (!Number.isSafeInteger(overage.operations) || overage.operations <= 0) {
    throw new Error(`${name}.operations must be a positive safe integer`);
  }
  requireNonNegative(`${name}.price`, overage.price);
};

for (const plan of plans) {
  requireNonNegative(`${plan.name}.monthlyPrice`, plan.monthlyPrice);
  requireNonNegative(`${plan.name}.includedExecutions`, plan.includedExecutions);
  requireNonNegative(`${plan.name}.includedSignatures`, plan.includedSignatures);
  requireNonNegative(`${plan.name}.includedSponsoredGasUsd`, plan.includedSponsoredGasUsd);
  requireShare(`${plan.name}.hsmExecutionShare`, plan.hsmExecutionShare);
  requireShare(`${plan.name}.hsmSignatureShare`, plan.hsmSignatureShare);
  requireOverage(`${plan.name}.executionOverage`, plan.executionOverage);
  requireOverage(`${plan.name}.signatureOverage`, plan.signatureOverage);
}

requireShare("targetPaidMargin.minimum", assumptions.targetPaidMargin.minimum);
requireShare("targetPaidMargin.maximum", assumptions.targetPaidMargin.maximum);
if (assumptions.targetPaidMargin.minimum > assumptions.targetPaidMargin.maximum) {
  throw new Error("targetPaidMargin.minimum must not exceed targetPaidMargin.maximum");
}

const pimlicoCreditPrice =
  pricing.pimlico.additionalCreditsPrice / pricing.pimlico.additionalCredits;
const standardPimlicoExecutionCost =
  pricing.pimlico.standardUserOperationCredits * pimlicoCreditPrice;
const sponsoredPimlicoExecutionCost =
  pricing.pimlico.sponsoredUserOperationCredits * pimlicoCreditPrice;
const alchemyComputeUnitPrice = pricing.alchemy.firstTierPricePerMillion / 1_000_000;
const alchemyExecutionCost = assumptions.alchemyComputeUnitsPerExecution * alchemyComputeUnitPrice;
const softwareKmsOperationCost =
  pricing.gcp.softwareOperationsPrice / pricing.gcp.softwareOperations;
const hsmKmsOperationCost = pricing.gcp.hsmOperationsPrice / pricing.gcp.hsmOperations;
const resendEmailCost = pricing.resend.overagePrice / pricing.resend.overageEmails;
const stripeRate =
  pricing.stripe.billingRate + pricing.stripe.paymentRate + pricing.stripe.currencyConversionRate;

const getSigningCost = (hsmShare: number) =>
  hsmKmsOperationCost * hsmShare + softwareKmsOperationCost * (1 - hsmShare);

const getOverageUnitPrice = (overage: OveragePrice) => overage.price / overage.operations;

const formatOverage = (overage: OveragePrice | null) =>
  overage === null ? "Hard cap" : `${usd(overage.price)} / ${integer(overage.operations)}`;

const getPlanCosts = (plan: Plan): PlanCosts => ({
  // Sponsored UserOperation credits pay for Pimlico infrastructure. The actual gas
  // invoice is capped independently by includedSponsoredGasUsd below.
  pimlico: plan.includedExecutions * sponsoredPimlicoExecutionCost,
  alchemy: plan.includedExecutions * alchemyExecutionCost,
  gcpKeys:
    plan.softwareWallets * pricing.gcp.softwareKeyVersionPerMonth +
    plan.hsmWallets * pricing.gcp.hsmKeyVersionPerMonth,
  executionSigning: plan.includedExecutions * getSigningCost(plan.hsmExecutionShare),
  signatureSigning: plan.includedSignatures * getSigningCost(plan.hsmSignatureShare),
  sponsoredGas: plan.includedSponsoredGasUsd,
  resend: plan.members * assumptions.emailsPerMemberPerMonth * resendEmailCost,
  stripe: plan.monthlyPrice * stripeRate,
});

const totalCosts = (costs: PlanCosts) => Object.values(costs).reduce((sum, cost) => sum + cost, 0);

const marginCell = (revenue: number, contribution: number) => {
  if (revenue === 0) return ansi.dim("—");
  const margin = contribution / revenue;
  const formatted = percentage(margin);
  if (
    margin >= assumptions.targetPaidMargin.minimum &&
    margin <= assumptions.targetPaidMargin.maximum
  ) {
    return ansi.green(formatted);
  }
  if (margin > assumptions.targetPaidMargin.maximum) return ansi.yellow(formatted);
  return ansi.red(formatted);
};

const marginTargetCell = (revenue: number, contribution: number) => {
  if (revenue === 0) return ansi.dim("—");
  const margin = contribution / revenue;
  if (margin < assumptions.targetPaidMargin.minimum) return ansi.red("Below target");
  if (margin > assumptions.targetPaidMargin.maximum) return ansi.yellow("Above target");
  return ansi.green("Within target");
};

const escapeMarkdownCell = (value: string) => value.replaceAll("|", "\\|");

const renderMarkdownTable = (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
) => {
  const escapedHeaders = headers.map(escapeMarkdownCell);
  const escapedRows = rows.map((row) => row.map(escapeMarkdownCell));
  const widths = escapedHeaders.map((header, index) =>
    Math.max(3, header.length, ...escapedRows.map((row) => (row[index] ?? "").length)),
  );
  const renderRow = (row: ReadonlyArray<string>) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(" | ")} |`;

  return [
    renderRow(escapedHeaders),
    renderRow(widths.map((width) => "-".repeat(width))),
    ...escapedRows.map(renderRow),
  ].join("\n");
};

const buildMarkdownReport = () => {
  const planRows = plans.map((plan) => {
    const costs = getPlanCosts(plan);
    const total = totalCosts(costs);
    const contribution = plan.monthlyPrice - total;
    return [
      plan.name,
      usd(plan.monthlyPrice),
      integer(plan.members),
      integer(plan.softwareWallets),
      integer(plan.hsmWallets),
      integer(plan.includedExecutions),
      formatOverage(plan.executionOverage),
      integer(plan.includedSignatures),
      formatOverage(plan.signatureOverage),
      usd(plan.includedSponsoredGasUsd),
      usd(total),
      usd(contribution),
      plan.monthlyPrice === 0 ? "—" : percentage(contribution / plan.monthlyPrice),
    ];
  });

  const costRows = plans.map((plan) => {
    const costs = getPlanCosts(plan);
    return [
      plan.name,
      usd(costs.pimlico),
      usd(costs.alchemy),
      usd(costs.gcpKeys),
      usd(costs.executionSigning),
      usd(costs.signatureSigning),
      usd(costs.sponsoredGas),
      usd(costs.resend),
      usd(costs.stripe),
      usd(totalCosts(costs)),
    ];
  });

  const overageRows = plans
    .filter(
      (plan): plan is Plan & { readonly executionOverage: OveragePrice } =>
        plan.executionOverage !== null,
    )
    .map((plan) => {
      const price = getOverageUnitPrice(plan.executionOverage);
      const kms = getSigningCost(plan.hsmExecutionShare);
      const stripe = price * stripeRate;
      const cost = sponsoredPimlicoExecutionCost + kms + stripe;
      const contribution = price - cost;
      return [
        plan.name,
        formatOverage(plan.executionOverage),
        usd(price, 6),
        usd(sponsoredPimlicoExecutionCost, 6),
        usd(kms, 6),
        usd(stripe, 6),
        usd(contribution, 6),
        percentage(contribution / price),
      ];
    });

  const signatureOverageRows = plans
    .filter(
      (plan): plan is Plan & { readonly signatureOverage: OveragePrice } =>
        plan.signatureOverage !== null,
    )
    .map((plan) => {
      const price = getOverageUnitPrice(plan.signatureOverage);
      const kms = getSigningCost(plan.hsmSignatureShare);
      const stripe = price * stripeRate;
      const contribution = price - kms - stripe;
      return [
        plan.name,
        formatOverage(plan.signatureOverage),
        usd(price, 6),
        usd(kms, 6),
        usd(stripe, 6),
        usd(contribution, 6),
        percentage(contribution / price),
      ];
    });

  const hsmStripe = assumptions.additionalHsmWalletPrice * stripeRate;
  const hsmContribution =
    assumptions.additionalHsmWalletPrice - pricing.gcp.hsmKeyVersionPerMonth - hsmStripe;

  const sponsoredGasRows = assumptions.sponsoredGasExamples.map((rawGas) => {
    const providerCost = rawGas * (1 + pricing.pimlico.sponsoredGasSurchargeRate);
    const customerCharge = providerCost * (1 + assumptions.sponsoredGasCustomerMarkupRate);
    const stripe = customerCharge * stripeRate;
    const contribution = customerCharge - providerCost - stripe;
    return [
      usd(rawGas, 4),
      usd(providerCost, 4),
      usd(customerCharge, 4),
      usd(stripe, 4),
      usd(contribution, 4),
      percentage(contribution / customerCharge),
    ];
  });

  return `# Namera billing margin report

> Generated by \`pnpm billing:margin\` from \`script/calculate-margin.ts\`. Edit the calculator inputs and rerun the command instead of editing this file manually.

This report uses scalable marginal vendor costs at full included usage and reserves each plan's complete sponsored-gas allowance. Shared account-wide free tiers reduce early cash costs but are intentionally excluded from plan margins. Paid plan defaults target ${percentage(assumptions.targetPaidMargin.minimum)}–${percentage(assumptions.targetPaidMargin.maximum)} contribution margin.

## Plan economics

${renderMarkdownTable(
  [
    "Plan",
    "Price",
    "Members",
    "Software wallets",
    "HSM wallets",
    "Executions",
    "Execution overage",
    "Signatures",
    "Signature overage",
    "Sponsored gas",
    "Vendor cost",
    "Contribution",
    "Margin",
  ],
  planRows,
)}

## Effective marginal rates

${renderMarkdownTable(
  ["Cost", "Rate", "Source input"],
  [
    [
      "Pimlico standard UserOperation",
      usd(standardPimlicoExecutionCost, 6),
      `${integer(pricing.pimlico.standardUserOperationCredits)} credits`,
    ],
    [
      "Pimlico sponsored UserOperation",
      usd(sponsoredPimlicoExecutionCost, 6),
      `${integer(pricing.pimlico.sponsoredUserOperationCredits)} credits plus gas`,
    ],
    [
      "Alchemy per execution",
      usd(alchemyExecutionCost, 6),
      `${integer(assumptions.alchemyComputeUnitsPerExecution)} CU`,
    ],
    ["GCP software key", usd(pricing.gcp.softwareKeyVersionPerMonth), "Active key-month"],
    ["GCP HSM key", usd(pricing.gcp.hsmKeyVersionPerMonth), "Active key-month"],
    ["GCP software signing", usd(softwareKmsOperationCost, 6), "Operation"],
    ["GCP HSM signing", usd(hsmKmsOperationCost, 6), "Operation"],
    ["Resend email", usd(resendEmailCost, 6), "Marginal overage rate"],
    ["Stripe", percentage(stripeRate), "Payment, Billing, and conversion"],
  ],
)}

## Cost breakdown by plan

${renderMarkdownTable(
  [
    "Plan",
    "Pimlico",
    "Alchemy",
    "GCP keys",
    "Execution signing",
    "Signature signing",
    "Sponsored gas",
    "Resend",
    "Stripe",
    "Total",
  ],
  costRows,
)}

## Execution overage economics

${renderMarkdownTable(
  ["Plan", "Overage block", "Unit price", "Pimlico", "KMS", "Stripe", "Contribution", "Margin"],
  overageRows,
)}

Execution overage pays for Pimlico's sponsored UserOperation credits and GCP signing. Sponsored gas is charged against the separate dollar balance and is not included here. Alchemy remains in the full-plan cost breakdown as shared RPC overhead.

## Signature overage economics

${renderMarkdownTable(
  ["Plan", "Overage block", "Unit price", "KMS", "Stripe", "Contribution", "Margin"],
  signatureOverageRows,
)}

## Additional HSM wallet economics

${renderMarkdownTable(
  ["Revenue", "GCP HSM", "Stripe", "Contribution", "Margin"],
  [
    [
      usd(assumptions.additionalHsmWalletPrice),
      usd(pricing.gcp.hsmKeyVersionPerMonth),
      usd(hsmStripe),
      usd(hsmContribution),
      percentage(hsmContribution / assumptions.additionalHsmWalletPrice),
    ],
  ],
)}

## Sponsored gas pass-through examples

These examples apply the configured Pimlico surcharge and customer markup. The normal execution charge remains separate.

${renderMarkdownTable(
  ["Raw gas", "Pimlico gas invoice", "Customer charge", "Stripe", "Contribution", "Margin"],
  sponsoredGasRows,
)}

## Shared provider allowances

${renderMarkdownTable(
  ["Provider", "Account-wide allowance", "Approximate equivalent"],
  [
    [
      "Pimlico",
      `${integer(pricing.pimlico.includedCreditsPerMonth)} credits`,
      `${integer(
        Math.floor(
          pricing.pimlico.includedCreditsPerMonth / pricing.pimlico.sponsoredUserOperationCredits,
        ),
      )} sponsored UserOperations`,
    ],
    [
      "Alchemy",
      `${integer(pricing.alchemy.includedComputeUnitsPerMonth)} CU`,
      `${integer(
        Math.floor(
          pricing.alchemy.includedComputeUnitsPerMonth /
            assumptions.alchemyComputeUnitsPerExecution,
        ),
      )} modeled executions`,
    ],
    [
      "Resend",
      `${integer(pricing.resend.freeEmailsPerMonth)} emails`,
      "Shared across all organizations",
    ],
  ],
)}

## Exclusions

This model includes each plan's complete sponsored-gas allowance as a worst-case cost. It excludes servers, databases, telemetry, support, taxes, refunds, disputes, and fraud. Gas used beyond the included balance is modeled separately as metered overage.
`;
};

console.log(ansi.bold("\nNamera billing margin calculator"));
console.log(
  ansi.dim(
    `Full included usage with gas reserved separately. Paid target: ${percentage(
      assumptions.targetPaidMargin.minimum,
    )}–${percentage(assumptions.targetPaidMargin.maximum)}.`,
  ),
);

section("Plan inputs");
console.log(
  renderTable(
    [
      { header: "Plan" },
      { header: "Price", align: "right" },
      { header: "Members", align: "right" },
      { header: "Software", align: "right" },
      { header: "HSM", align: "right" },
      { header: "Executions", align: "right" },
      { header: "Exec. overage", align: "right" },
      { header: "Signatures", align: "right" },
      { header: "Sig. overage", align: "right" },
      { header: "Gas cap", align: "right" },
    ],
    plans.map((plan) => [
      plan.name,
      usd(plan.monthlyPrice),
      integer(plan.members),
      integer(plan.softwareWallets),
      integer(plan.hsmWallets),
      integer(plan.includedExecutions),
      formatOverage(plan.executionOverage),
      integer(plan.includedSignatures),
      formatOverage(plan.signatureOverage),
      usd(plan.includedSponsoredGasUsd),
    ]),
  ),
);

section("Effective marginal rates");
console.log(
  renderTable(
    [{ header: "Cost" }, { header: "Rate", align: "right" }, { header: "Source input" }],
    [
      [
        "Pimlico standard UserOperation",
        usd(standardPimlicoExecutionCost, 6),
        `${integer(pricing.pimlico.standardUserOperationCredits)} credits`,
      ],
      [
        "Pimlico sponsored UserOperation",
        usd(sponsoredPimlicoExecutionCost, 6),
        `${integer(pricing.pimlico.sponsoredUserOperationCredits)} credits + gas`,
      ],
      [
        "Alchemy per execution",
        usd(alchemyExecutionCost, 6),
        `${integer(assumptions.alchemyComputeUnitsPerExecution)} CU`,
      ],
      ["GCP software key", usd(pricing.gcp.softwareKeyVersionPerMonth), "per active month"],
      ["GCP HSM key", usd(pricing.gcp.hsmKeyVersionPerMonth), "per active month"],
      ["GCP software signing", usd(softwareKmsOperationCost, 6), "per operation"],
      ["GCP HSM signing", usd(hsmKmsOperationCost, 6), "per operation"],
      ["Resend email", usd(resendEmailCost, 6), "marginal overage rate"],
      ["Stripe", percentage(stripeRate), "payment + Billing + conversion"],
    ],
  ),
);

section("Plan contribution margin at full included usage");
console.log(
  renderTable(
    [
      { header: "Plan" },
      { header: "Revenue", align: "right" },
      { header: "Vendor cost", align: "right" },
      { header: "Contribution", align: "right" },
      { header: "Margin", align: "right" },
      { header: "Target", align: "right" },
    ],
    plans.map((plan) => {
      const costs = getPlanCosts(plan);
      const total = totalCosts(costs);
      const contribution = plan.monthlyPrice - total;
      return [
        plan.name,
        usd(plan.monthlyPrice),
        usd(total),
        contribution >= 0 ? ansi.green(usd(contribution)) : ansi.red(usd(contribution)),
        marginCell(plan.monthlyPrice, contribution),
        marginTargetCell(plan.monthlyPrice, contribution),
      ];
    }),
  ),
);

section("Cost breakdown by plan");
console.log(
  renderTable(
    [
      { header: "Plan" },
      { header: "Pimlico", align: "right" },
      { header: "Alchemy", align: "right" },
      { header: "GCP keys", align: "right" },
      { header: "Exec sign", align: "right" },
      { header: "Sig sign", align: "right" },
      { header: "Gas cap", align: "right" },
      { header: "Resend", align: "right" },
      { header: "Stripe", align: "right" },
      { header: "Total", align: "right" },
    ],
    plans.map((plan) => {
      const costs = getPlanCosts(plan);
      return [
        plan.name,
        usd(costs.pimlico),
        usd(costs.alchemy),
        usd(costs.gcpKeys),
        usd(costs.executionSigning),
        usd(costs.signatureSigning),
        usd(costs.sponsoredGas),
        usd(costs.resend),
        usd(costs.stripe),
        usd(totalCosts(costs)),
      ];
    }),
  ),
);

section("Execution overage economics");
const plansWithOverage = plans.filter(
  (plan): plan is Plan & { readonly executionOverage: OveragePrice } =>
    plan.executionOverage !== null,
);
console.log(
  renderTable(
    [
      { header: "Plan" },
      { header: "Overage block", align: "right" },
      { header: "Unit price", align: "right" },
      { header: "Pimlico", align: "right" },
      { header: "KMS", align: "right" },
      { header: "Stripe", align: "right" },
      { header: "Profit", align: "right" },
      { header: "Margin", align: "right" },
    ],
    plansWithOverage.map((plan) => {
      const price = getOverageUnitPrice(plan.executionOverage);
      const kms = getSigningCost(plan.hsmExecutionShare);
      const stripe = price * stripeRate;
      const cost = sponsoredPimlicoExecutionCost + kms + stripe;
      const profit = price - cost;
      return [
        plan.name,
        formatOverage(plan.executionOverage),
        usd(price, 6),
        usd(sponsoredPimlicoExecutionCost, 6),
        usd(kms, 6),
        usd(stripe, 6),
        profit >= 0 ? ansi.green(usd(profit, 6)) : ansi.red(usd(profit, 6)),
        marginCell(price, profit),
      ];
    }),
  ),
);
console.log(
  ansi.dim(
    "Execution overage covers Pimlico sponsored-UserOperation credits and signing only; gas uses the separate dollar balance.",
  ),
);

section("Signature overage economics");
const plansWithSignatureOverage = plans.filter(
  (plan): plan is Plan & { readonly signatureOverage: OveragePrice } =>
    plan.signatureOverage !== null,
);
console.log(
  renderTable(
    [
      { header: "Plan" },
      { header: "Overage block", align: "right" },
      { header: "Unit price", align: "right" },
      { header: "KMS", align: "right" },
      { header: "Stripe", align: "right" },
      { header: "Profit", align: "right" },
      { header: "Margin", align: "right" },
    ],
    plansWithSignatureOverage.map((plan) => {
      const price = getOverageUnitPrice(plan.signatureOverage);
      const kms = getSigningCost(plan.hsmSignatureShare);
      const stripe = price * stripeRate;
      const profit = price - kms - stripe;
      return [
        plan.name,
        formatOverage(plan.signatureOverage),
        usd(price, 6),
        usd(kms, 6),
        usd(stripe, 6),
        profit >= 0 ? ansi.green(usd(profit, 6)) : ansi.red(usd(profit, 6)),
        marginCell(price, profit),
      ];
    }),
  ),
);

section("Additional HSM wallet economics");
const hsmAddOnRevenue = assumptions.additionalHsmWalletPrice;
const hsmAddOnStripe = hsmAddOnRevenue * stripeRate;
const hsmAddOnCost = pricing.gcp.hsmKeyVersionPerMonth + hsmAddOnStripe;
const hsmAddOnContribution = hsmAddOnRevenue - hsmAddOnCost;
console.log(
  renderTable(
    [
      { header: "Revenue", align: "right" },
      { header: "GCP HSM", align: "right" },
      { header: "Stripe", align: "right" },
      { header: "Contribution", align: "right" },
      { header: "Margin", align: "right" },
    ],
    [
      [
        usd(hsmAddOnRevenue),
        usd(pricing.gcp.hsmKeyVersionPerMonth),
        usd(hsmAddOnStripe),
        ansi.green(usd(hsmAddOnContribution)),
        marginCell(hsmAddOnRevenue, hsmAddOnContribution),
      ],
    ],
  ),
);

section("Sponsored gas pass-through examples");
console.log(
  renderTable(
    [
      { header: "Raw gas", align: "right" },
      { header: "Pimlico gas invoice", align: "right" },
      { header: "Customer charge", align: "right" },
      { header: "Stripe", align: "right" },
      { header: "Contribution", align: "right" },
      { header: "Margin", align: "right" },
    ],
    assumptions.sponsoredGasExamples.map((rawGas) => {
      const providerCost = rawGas * (1 + pricing.pimlico.sponsoredGasSurchargeRate);
      const customerCharge = providerCost * (1 + assumptions.sponsoredGasCustomerMarkupRate);
      const stripe = customerCharge * stripeRate;
      const contribution = customerCharge - providerCost - stripe;
      return [
        usd(rawGas, 4),
        usd(providerCost, 4),
        usd(customerCharge, 4),
        usd(stripe, 4),
        usd(contribution, 4),
        marginCell(customerCharge, contribution),
      ];
    }),
  ),
);

section("Shared provider allowances");
console.log(
  renderTable(
    [
      { header: "Provider" },
      { header: "Account-wide allowance", align: "right" },
      { header: "Approximate equivalent" },
    ],
    [
      [
        "Pimlico",
        `${integer(pricing.pimlico.includedCreditsPerMonth)} credits`,
        `${integer(
          Math.floor(
            pricing.pimlico.includedCreditsPerMonth / pricing.pimlico.sponsoredUserOperationCredits,
          ),
        )} sponsored UserOperations`,
      ],
      [
        "Alchemy",
        `${integer(pricing.alchemy.includedComputeUnitsPerMonth)} CU`,
        `${integer(
          Math.floor(
            pricing.alchemy.includedComputeUnitsPerMonth /
              assumptions.alchemyComputeUnitsPerExecution,
          ),
        )} modeled executions`,
      ],
      [
        "Resend",
        `${integer(pricing.resend.freeEmailsPerMonth)} emails`,
        "shared across all organizations",
      ],
    ],
  ),
);

console.log(
  `\n${ansi.dim(
    "Notes: includes each plan's complete sponsored-gas allowance. Excludes servers, database, telemetry, support, tax, refunds, disputes, and fraud. " +
      "Pooled free tiers reduce early cash cost but are intentionally excluded from scalable plan margins.",
  )}\n`,
);

const markdownReportUrl = new URL("../progress/pricing.md", import.meta.url);
writeFileSync(markdownReportUrl, buildMarkdownReport());
console.log(ansi.dim("Saved Markdown report to progress/pricing.md"));
