import type {
  CompleteExecutionResponse,
  GetExecutionSubmissionResponse,
  ListExecutionsResponse,
  SimulateExecutionResponse,
  SignResponse,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";

import { collection, humanize, network, section, type PrettyPrinter } from "./document.js";

export const executionStatusView: PrettyPrinter<
  GetExecutionSubmissionResponse | CompleteExecutionResponse
> = (result, colors) =>
  [
    section(
      `Execution ${humanize(result.status).toLowerCase()}`,
      [
        ["Status", humanize(result.status)],
        ["Submission ID", result.submissionId],
        [
          "User operation",
          "userOperationHash" in result ? (result.userOperationHash ?? undefined) : undefined,
        ],
        ...(result.status === "confirmed" && "execution" in result
          ? ([
              ["Execution ID", result.execution.id],
              ["Network", network(result.execution.data.chainId)],
              ["Transaction", result.execution.data.transactionHash],
              ["Created", result.execution.createdAt],
            ] as const)
          : []),
      ],
      colors,
    ),
    ...(["reserved", "prepared", "submitted"].includes(result.status)
      ? [`Not confirmed yet. Check again with:\n  namera execution status ${result.submissionId}`]
      : []),
  ].join("\n\n");

export const executionsView: PrettyPrinter<ListExecutionsResponse> = (result, colors) =>
  [
    collection(
      result.items,
      "confirmed execution",
      "confirmed executions",
      (item, useColors) =>
        section(
          item.wallet.metadata.name,
          [
            ["Execution ID", item.details.id],
            ["Network", network(item.details.chainId)],
            ["Transaction", item.details.transactionHash],
            ["Session key", item.sessionKey.metadata.name],
            ["Created", item.details.createdAt],
          ],
          useColors,
        ),
      colors,
    ),
    ...(result.nextCursor
      ? [`Next page:\n  namera execution list --cursor ${result.nextCursor}`]
      : []),
  ].join("\n\n");

export const simulationView: PrettyPrinter<SimulateExecutionResponse> = (result, colors) =>
  [
    section(
      "Execution simulation",
      [
        ["Policy decision", result.allowed ? "Allowed" : "Denied"],
        ["Calls", result.callsSucceeded ? "Succeeded" : "Failed"],
        ["Wallet ID", result.walletId],
        ["Account", result.account],
        ["Network", network(result.chainId)],
        ["Session key ID", result.allowed ? result.sessionKeyId : undefined],
        ["Denials", result.allowed ? undefined : result.denials],
      ],
      colors,
    ),
    section(
      "Simulation details",
      [
        ["Gas estimate", result.simulation.userOperation],
        ["Calls", result.simulation.calls],
      ],
      colors,
    ),
    "Simulation only. No transaction was submitted.",
  ].join("\n\n");

export const signatureView: PrettyPrinter<SignResponse> = (result, colors) =>
  section(
    "Signature created",
    [
      ["Type", result.type === "typed-data" ? "Typed data (EIP-712)" : "Message"],
      ["Account", result.account],
      ["Wallet ID", result.walletId],
      ["Network", network(result.chainId)],
      ["Signature", result.signature],
    ],
    colors,
  );

export const verificationView: PrettyPrinter<VerifySignatureResponse> = (result, colors) =>
  section(
    result.valid ? "Signature valid" : "Signature invalid",
    [
      ["Valid", result.valid],
      ["Account", result.account],
      ["Wallet ID", result.walletId],
      ["Network", network(result.chainId)],
      ["Type", humanize(result.type)],
    ],
    colors,
  );
