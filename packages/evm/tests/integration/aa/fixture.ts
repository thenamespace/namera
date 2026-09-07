import { generateKeyPairSync, sign } from "node:crypto";

import * as P256 from "ox/P256";
import * as Signature from "ox/Signature";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseEther,
  type Hex,
  type PublicClient,
  type Chain,
  type Transport,
  type TransactionReceipt,
} from "viem";
import {
  entryPoint07Abi,
  toPackedUserOperation,
  type SmartAccount,
  type UserOperation,
} from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { makeAlchemyModularV2Account } from "../../../src/accounts/alchemy-modular-v2.js";
import { createWalletKeyWebAuthnAccount } from "../../../src/accounts/webauthn.js";

export const makeAnvilFixture = async (
  url: string,
): Promise<{
  readonly account: SmartAccount;
  readonly publicClient: PublicClient<Transport, Chain>;
  readonly submit: (signer: SmartAccount, callData: Hex) => Promise<TransactionReceipt>;
  readonly advanceTime: (seconds: number) => Promise<void>;
}> => {
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
  ) {
    throw new Error("AA tests require an explicit loopback Anvil URL");
  }
  const transport = http(url, { timeout: 30_000, retryCount: 0 });
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const version = await publicClient.request({ method: "web3_clientVersion" });
  if (!version.toLowerCase().includes("anvil")) throw new Error("AA tests only run on Anvil");
  const testClient = createTestClient({ chain: sepolia, mode: "anvil", transport });
  const relayer = privateKeyToAccount(generatePrivateKey());
  await testClient.setBalance({ address: relayer.address, value: parseEther("100") });
  const walletClient = createWalletClient({ account: relayer, chain: sepolia, transport });
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error("Missing P-256 coordinates");
  const publicKeyHex =
    `0x04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}` as Hex;
  const owner = createWalletKeyWebAuthnAccount({
    id: "local-aa-test",
    publicKey: publicKeyHex,
    origin: "http://localhost:3000",
    rpId: "localhost",
    validatorType: "webauthn_p256",
    sign: async (payload) => {
      const signature = Signature.fromDerBytes(sign("sha256", payload, privateKey));
      const order = P256.noble.CURVE.n;
      // Authenticators may return either half of the curve; exercise high-S deterministically.
      return Signature.toDerBytes({
        ...signature,
        s: signature.s > order / 2n ? signature.s : order - signature.s,
      });
    },
  });
  const account = await makeAlchemyModularV2Account(
    {
      entryPointVersion: "0.7",
      salt: 0n,
      entityId: 0,
      owner: { validatorType: "webauthn_p256", account: owner },
    },
    publicClient,
  );
  await testClient.setBalance({ address: account.address, value: parseEther("10") });

  const submit = async (signer: SmartAccount, callData: Hex) => {
    const userOperation: UserOperation<"0.7"> = {
      sender: signer.address,
      nonce: await signer.getNonce(),
      ...(await signer.getFactoryArgs()),
      callData,
      callGasLimit: 2_000_000n,
      verificationGasLimit: 2_000_000n,
      preVerificationGas: 100_000n,
      maxFeePerGas: 10_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      signature: "0x",
    };
    userOperation.signature = await signer.signUserOperation(userOperation);
    await publicClient.simulateContract({
      account: relayer,
      address: account.entryPoint.address,
      abi: entryPoint07Abi,
      functionName: "handleOps",
      args: [[toPackedUserOperation(userOperation)], relayer.address],
      gas: 8_000_000n,
    });
    const hash = await walletClient.writeContract({
      address: account.entryPoint.address,
      abi: entryPoint07Abi,
      functionName: "handleOps",
      args: [[toPackedUserOperation(userOperation)], relayer.address],
      gas: 8_000_000n,
    });
    return await publicClient.waitForTransactionReceipt({ hash });
  };
  return {
    account,
    publicClient,
    submit,
    advanceTime: async (seconds) => {
      await testClient.increaseTime({ seconds });
      await testClient.mine({ blocks: 1 });
    },
  };
};
