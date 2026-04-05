import type { Policy } from "@zerodev/permissions";
import type { WebAuthnKey } from "@zerodev/webauthn-key";
import type {
  Chain,
  Client,
  EntryPointVersion,
  Hex,
  JsonRpcAccount,
  LocalAccount,
  RpcSchema,
  Transport,
} from "viem";
import type { PaymasterClient } from "viem/account-abstraction";

import type { AccountType } from "@/account";
import type {
  BaseKernelAccountClient,
  GetKernelVersion,
  Signer,
} from "@/types";

export type SessionKeyType = "ecdsa" | "passkey";

type EcdsaSessionKeyParams = {
  sessionPrivateKey: Hex;
};

type EcdsaAccountParams = {
  signer: Signer;
};

type PasskeySessionKeyParams = {
  webAuthnSessionKey: WebAuthnKey;
};

type PasskeyAccountParams = {
  webAuthnKey: WebAuthnKey;
};

type SessionKeyParamsMap = {
  ecdsa: EcdsaSessionKeyParams;
  passkey: PasskeySessionKeyParams;
};

type SessionKeyAccountParamsMap = {
  ecdsa: EcdsaAccountParams;
  passkey: PasskeyAccountParams;
};

export type CreateSessionKeyResult = {
  serializedAccounts: {
    chainId: number;
    serializedAccount: string;
  }[];
};

export type CreateSessionKeyParams<
  TEntrypointVersion extends EntryPointVersion = EntryPointVersion,
  TKernelVersion extends
    GetKernelVersion<TEntrypointVersion> = GetKernelVersion<TEntrypointVersion>,
  TSessionKeyType extends SessionKeyType = SessionKeyType,
  TAccountType extends AccountType = AccountType,
> = {
  type: TSessionKeyType;
  accountType: TAccountType;
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
  clients: Client<
    Transport,
    Chain,
    JsonRpcAccount | LocalAccount | undefined
  >[];
  index?: bigint;
  policies: Policy[];
} & SessionKeyParamsMap[TSessionKeyType] &
  SessionKeyAccountParamsMap[TAccountType];

export type CreateSessionKeyClientParams<
  TSessionKeyType extends SessionKeyType = SessionKeyType,
  TClientTransport extends Transport = Transport,
  TBundlerTransport extends Transport = Transport,
  TPaymasterTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
  TEntrypointVersion extends EntryPointVersion = EntryPointVersion,
  TKernelVersion extends
    GetKernelVersion<TEntrypointVersion> = GetKernelVersion<TEntrypointVersion>,
> = {
  type: TSessionKeyType;
  client: Client<
    TClientTransport,
    TChain,
    JsonRpcAccount | LocalAccount | undefined
  >;
  chain: TChain;
  serializedAccount: string;
  bundlerTransport: TBundlerTransport;
  paymaster?: PaymasterClient<TPaymasterTransport, TRpcSchema>;
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
} & SessionKeyAccountParamsMap[TSessionKeyType];

export type RevokeSessionKeyParams<
  TSessionKeyType extends SessionKeyType = SessionKeyType,
  TEntrypointVersion extends EntryPointVersion = EntryPointVersion,
  TKernelVersion extends
    GetKernelVersion<TEntrypointVersion> = GetKernelVersion<TEntrypointVersion>,
> = {
  type: TSessionKeyType;
  entrypointVersion: TEntrypointVersion;
  kernelVersion: TKernelVersion;
  serializedAccount: string;
  client: BaseKernelAccountClient;
} & SessionKeyAccountParamsMap[TSessionKeyType];
