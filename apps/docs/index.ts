import { createAccountClient } from "@namera-ai/sdk/account";
import { createPublicClient, http } from "viem";
import { createPaymasterClient } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const paymaster = createPaymasterClient({
  transport: http("ZERO_DEV_PAYMASTER_URL"),
});

const signer = privateKeyToAccount(generatePrivateKey());

const client = await createAccountClient({
  bundlerTransport: http("https://public.pimlico.io/v2/1/rpc"), // Public Pimlico RPC
  chain: mainnet,
  client: publicClient,
  entrypointVersion: "0.7",
  kernelVersion: "0.3.2",
  paymaster,
  signer,
  type: "ecdsa",
});

client.prepareUserOperation;
