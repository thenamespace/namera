import type { KernelAccountClient } from "@zerodev/sdk";
import type { Chain, Client, RpcSchema, Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";

export type BaseKernelAccountClient = KernelAccountClient<
  Transport,
  Chain,
  SmartAccount,
  Client,
  RpcSchema
>;

export type * from "@zerodev/sdk/types";
