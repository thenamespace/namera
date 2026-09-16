import type React from "react";

import {
  AlchemyIcon,
  Blockchain01Icon,
  BrandClaudeIcon,
  Calculator01Icon,
  CodeIcon,
  Coins01Icon,
  ComputerTerminal01Icon,
  Icon,
  SignatureIcon,
  TestTube01Icon,
} from "@namera-ai/ui/icons";

/* -------------------------------------------------------------------------
 * What the canvas draws is what the server actually does.
 *
 *   prepare   application/execution/prepare-local.ts + evm/execution/prepare.ts
 *     estimate    eth_estimateUserOperationGas        (Alchemy bundler)
 *     sponsor     applyEvmExecutionSponsorship        (Alchemy paymaster)
 *     simulate    viem.simulateCalls
 *   policy    evm.policy.reserve, inside a transaction that locks the wallet
 *             row, so two agents cannot both spend the last of a cap
 *   sign      locally, by the session key; the key never leaves the machine
 *   complete  application/execution/complete-local.ts
 *     the policy is evaluated a second time at signature time
 *     submit      evm/execution/submit.ts → sendUserOperation
 *     chain       evm/execution/receipt.ts → the bundler's receipt
 *
 * A refusal stops at the policy: nothing is signed and nothing is sent.
 * ---------------------------------------------------------------------- */

export type Glyph = (props: { readonly className?: string | undefined }) => React.ReactElement;

export const hugeicon =
  (icon: Parameters<typeof Icon>[0]["icon"]): Glyph =>
  ({ className }) => <Icon icon={icon} aria-hidden strokeWidth={1.7} className={className ?? ""} />;

export const SOURCES = [
  { id: "mcp", label: "Claude", note: "MCP tool call", Glyph: BrandClaudeIcon },
  { id: "sdk", label: "SDK", note: "executions.execute()", Glyph: hugeicon(CodeIcon) },
  { id: "cli", label: "CLI", note: "namera execution", Glyph: hugeicon(ComputerTerminal01Icon) },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const CHAINS = [
  { id: "ethereum", label: "Ethereum", allowed: true },
  { id: "base", label: "Base", allowed: true },
  { id: "arbitrum", label: "Arbitrum", allowed: false },
  { id: "optimism", label: "Optimism", allowed: false },
] as const;

export type ChainId = (typeof CHAINS)[number]["id"];

/*
 * Two routes, each with the per-transaction cap the session key carries for
 * that token, the same shape the playground section uses.
 */
export const ROUTES = [
  {
    id: "buy",
    label: "USDC → ETH",
    sell: "USDC",
    cap: 100,
    amounts: ["25", "100", "250"],
  },
  {
    id: "sell",
    label: "ETH → USDC",
    sell: "ETH",
    cap: 0.05,
    amounts: ["0.01", "0.05", "0.2"],
  },
] as const;

export type RouteId = (typeof ROUTES)[number]["id"];

/** The session key the canvas runs against. */
export const KEY = {
  networks: "Ethereum, Base",
  expires: "27 Sept 2026",
  contract: "Uniswap only",
  signatures: "messages and typed data",
} as const;

export const PREPARE_STEPS = [
  {
    label: "Gas",
    note: "what the swap costs to run",
    Glyph: hugeicon(Calculator01Icon),
    value: "0.0021 ETH",
  },
  {
    label: "Sponsor",
    note: "Namera covers that gas",
    Glyph: hugeicon(Coins01Icon),
    value: "you pay nothing",
  },
  {
    label: "Dry run",
    note: "the swap is tried first",
    Glyph: hugeicon(TestTube01Icon),
    value: "no revert",
  },
] as const;

type PolicyCheck = {
  readonly label: string;
  readonly detail: string;
};

export const POLICY_CHECKS: readonly PolicyCheck[] = [
  { label: "Spend cap", detail: "per transaction" },
  { label: "Networks", detail: KEY.networks },
  { label: "Expires", detail: KEY.expires },
  { label: "Contracts", detail: KEY.contract },
  { label: "Signing", detail: KEY.signatures },
];

/*
 * One beat per thing that happens: the request leaving the agent, the three
 * preparation steps, the five rules, then signing, sending and confirming.
 */
export const ISSUE_AT = 0;
export const PREPARE_AT = 1;
export const POLICY_AT = 4;
export const SIGN_AT = 9;
export const SUBMIT_AT = 10;
export const CHAIN_AT = 11;
export const LAST_BEAT = 11;

export const BEAT_MS = [560, 620, 620, 620, 460, 460, 460, 460, 460, 700, 760, 820] as const;

export type Cell = "idle" | "active" | "pass" | "fail" | "skipped";
export type CardState = "idle" | "active" | "done" | "failed" | "skipped";

export { AlchemyIcon, Blockchain01Icon, SignatureIcon };
