import type {
  CompleteExecutionResponse,
  GetExecutionSubmissionResponse,
  ExecutionDetailsResponse,
  ListExecutionsResponse,
  SimulateExecutionResponse,
  SignResponse,
  VerifySignatureResponse,
  WalletResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";

import {
  collection,
  fields,
  heading,
  humanize,
  named,
  networkName,
  type PrettyPrinter,
  type Field,
} from "./document.js";
import { accountHeading, listArrow, paint } from "./style.js";

const executionRows = (entries: readonly Field[], colors: boolean) =>
  fields(entries, colors, 0)
    .split("\n")
    .map((line) => `${listArrow(colors)} ${line}`)
    .join("\n");

const submissionLabels = {
  reserved: "Awaiting signature",
  prepared: "Queued",
  submitted: "Pending confirmation",
  confirmed: "Confirmed",
  failed: "Failed",
} as const;

export const executionStatusView = (
  result: GetExecutionSubmissionResponse | CompleteExecutionResponse,
  colors: boolean,
  details?: ExecutionDetailsResponse,
): string => {
  const status = `${listArrow(colors)} ${heading("Status:", colors)} ${paint(submissionLabels[result.status], result.status === "confirmed" ? 32 : result.status === "failed" ? 31 : 33, colors)}`;
  if (result.status === "confirmed" && details) {
    return `${executionAccount(details, colors)}\n${status}\n${executionRows(executionFields(details), colors)}`;
  }
  const rows: readonly Field[] =
    result.status === "confirmed" && "execution" in result
      ? [
          ["Transaction Hash", result.execution.data.transactionHash],
          ["UserOp Hash", result.execution.data.userOperationHash],
          ["Network", networkName(result.execution.data.chainId)],
        ]
      : "userOperationHash" in result && result.userOperationHash
        ? [["UserOp Hash", result.userOperationHash]]
        : [];
  const next =
    result.status === "reserved"
      ? "Complete signing in the client that started this transaction. It has not been submitted."
      : result.status === "failed"
        ? "This submission failed. Review it in the dashboard before sending a new transaction."
        : result.status === "prepared" || result.status === "submitted"
          ? `Not confirmed yet. Check again with:\n  namera execution status ${result.submissionId}`
          : undefined;
  return [
    status,
    ...(rows.length ? [executionRows(rows, colors)] : []),
    ...(next ? [`\n${next}`] : []),
  ].join("\n");
};

const actorName = (actor: ExecutionDetailsResponse["actor"]): string => {
  switch (actor.type) {
    case "api-key":
      return `${actor.apiKey.metadata.name} (API Key)`;
    case "mcp":
      return `${actor.authorization.client.clientName} (MCP)`;
    case "cli":
      return `${actor.authorization.metadata.type === "cli" ? actor.authorization.metadata.deviceName : actor.authorization.client.clientName} (CLI)`;
    case "user":
      return `${actor.member.user.metadata.name ?? actor.member.user.email} (Dashboard)`;
  }
};

const executionAccount = (item: ExecutionDetailsResponse, colors: boolean) =>
  `${listArrow(colors)} ${heading("Account:", colors)} ${accountHeading(named(item.wallet.metadata), colors)}`;

const executionFields = (item: ExecutionDetailsResponse): readonly Field[] => [
  ["Transaction Hash", item.execution.data.transactionHash],
  ["UserOp Hash", item.execution.data.userOperationHash],
  ["Network", networkName(item.execution.data.chainId)],
  ["Actor", actorName(item.actor)],
  ["Session key", item.sessionKey.metadata.name],
];

export const executionsView: PrettyPrinter<{
  readonly items: readonly ExecutionDetailsResponse[];
  readonly nextCursor: ListExecutionsResponse["nextCursor"];
}> = (result, colors) =>
  [
    collection(
      result.items,
      "confirmed execution",
      "confirmed executions",
      (item, useColors) =>
        `${executionAccount(item, useColors)}\n${executionRows(executionFields(item), useColors)}`,
      colors,
    ),
    ...(result.nextCursor
      ? [`Next page:\n  namera execution list --cursor ${result.nextCursor}`]
      : []),
  ].join("\n\n");

export type OperationContext = {
  readonly wallet: Pick<WalletResponse, "metadata">;
  readonly key?: Pick<SessionKeyResponse, "metadata"> | undefined;
};

export const operationContextView = (
  context: OperationContext | undefined,
  chainId: string,
  colors: boolean,
  account?: string,
) =>
  [
    ...(context
      ? [
          `${listArrow(colors)} ${heading("Account:", colors)} ${accountHeading(named(context.wallet.metadata), colors)}`,
        ]
      : account
        ? [executionRows([["Account", account]], colors)]
        : []),
    executionRows(
      [
        ["Network", networkName(chainId)],
        ["Session key", context?.key?.metadata.name],
      ],
      colors,
    ),
  ].join("\n");

export const simulationView = (
  result: SimulateExecutionResponse,
  colors: boolean,
  context?: OperationContext,
): string =>
  [
    heading("Transaction preview", colors),
    operationContextView(context, result.chainId, colors, result.account),
    executionRows(
      [
        ["Policy decision", result.allowed ? "Allowed" : "Denied"],
        ["Calls", result.callsSucceeded ? "Succeeded" : "Failed"],
        [
          "Reason",
          result.allowed
            ? undefined
            : result.denials.map((denial) => humanize(denial.code.toLowerCase())).join(", "),
        ],
      ],
      colors,
    ),
    "\nSimulation only. No transaction was submitted.",
    ...(!result.allowed
      ? [
          "Review the session key's policies in the dashboard, or adjust the transaction and simulate again.",
        ]
      : !result.callsSucceeded
        ? ["Check the recipient, value, calldata, and account balance before trying again."]
        : []),
  ].join("\n");

export const signatureView = (
  result: SignResponse,
  colors: boolean,
  context?: OperationContext,
): string =>
  [
    heading("Signature created", colors),
    operationContextView(context, result.chainId, colors, result.account),
    executionRows(
      [
        ["Type", result.type === "typed-data" ? "Typed data (EIP-712)" : "Message"],
        ["Signature", result.signature],
      ],
      colors,
    ),
  ].join("\n");

export const verificationView = (
  result: VerifySignatureResponse,
  colors: boolean,
  context?: OperationContext,
): string =>
  [
    paint(result.valid ? "Signature valid" : "Signature invalid", result.valid ? 32 : 31, colors),
    operationContextView(context, result.chainId, colors, result.account),
    executionRows([["Type", humanize(result.type)]], colors),
    ...(!result.valid
      ? [
          "\nCheck the wallet, network, original message or typed data, and full signature, then try again.",
        ]
      : []),
  ].join("\n");
