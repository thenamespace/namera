import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseEther,
  type Hex,
  type PublicClient,
  type Transport,
  type Chain,
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

export const makeAnvilChainFixture = async (
  url: string,
): Promise<{
  readonly publicClient: PublicClient<Transport, Chain>;
  readonly fundAccount: (address: Hex) => Promise<void>;
  readonly submit: (
    signer: SmartAccount,
    callData: Hex,
    signOperation?: (operation: UserOperation<"0.7">) => Promise<Hex>,
  ) => Promise<TransactionReceipt>;
  readonly deployContract: (bytecode: Hex) => Promise<Hex>;
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
  if ((await publicClient.getChainId()) !== sepolia.id)
    throw new Error("AA tests require a Sepolia fork");
  const testClient = createTestClient({ chain: sepolia, mode: "anvil", transport });
  const relayer = privateKeyToAccount(generatePrivateKey());
  await testClient.setBalance({ address: relayer.address, value: parseEther("100") });
  const walletClient = createWalletClient({ account: relayer, chain: sepolia, transport });

  return {
    publicClient,
    fundAccount: (address: Hex) => testClient.setBalance({ address, value: parseEther("10") }),
    submit: async (
      signer: SmartAccount,
      callData: Hex,
      signOperation?: (operation: UserOperation<"0.7">) => Promise<Hex>,
    ) => {
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
      userOperation.signature = await (signOperation === undefined
        ? signer.signUserOperation(userOperation)
        : signOperation(userOperation));
      await publicClient.simulateContract({
        account: relayer,
        address: signer.entryPoint.address,
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [[toPackedUserOperation(userOperation)], relayer.address],
        gas: 8_000_000n,
      });
      const hash = await walletClient.writeContract({
        address: signer.entryPoint.address,
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [[toPackedUserOperation(userOperation)], relayer.address],
        gas: 8_000_000n,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    },
    deployContract: async (bytecode: Hex) => {
      const hash = await walletClient.deployContract({ abi: [], bytecode });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (
        receipt.status !== "success" ||
        receipt.contractAddress === null ||
        receipt.contractAddress === undefined
      )
        throw new Error("Test contract deployment failed");
      return receipt.contractAddress;
    },
    advanceTime: async (seconds: number) => {
      await testClient.increaseTime({ seconds });
      await testClient.mine({ blocks: 1 });
    },
  };
};
