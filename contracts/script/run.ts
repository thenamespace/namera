// Runs the Foundry deploy scripts across chains from chains/chains.json.
//
//   node script/run.ts status [--chain <slug>... | --network mainnet|testnet | --all]
//   node script/run.ts deploy  --chain <slug>... | --network mainnet|testnet | --all
//   node script/run.ts verify  --chain <slug>... | --network mainnet|testnet | --all
//
// RPC: the chain's `rpcEnv` variable, else its `publicRpc`. Deploy needs DEPLOYER_ACCOUNT (a
// `cast wallet` keystore name). Etherscan verification needs ETHERSCAN_API_KEY; Sourcify needs none.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

interface Chain {
  id: number;
  slug: string;
  name: string;
  network: "mainnet" | "testnet";
  rpcEnv: string;
  publicRpc: string;
  verifiers: ("sourcify" | "etherscan")[];
}

interface ManifestEntry {
  artifact: string;
  address: string;
}

const COMMANDS = ["status", "deploy", "verify"] as const;
type Command = (typeof COMMANDS)[number];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    chain: { type: "string", multiple: true },
    network: { type: "string" },
    all: { type: "boolean", default: false },
  },
});

const command = positionals[0] as Command | undefined;
if (!command || !COMMANDS.includes(command)) {
  fail(`usage: run.ts <${COMMANDS.join("|")}> [--chain <slug>... | --network <name> | --all]`);
}

const chains = selectChains(
  (JSON.parse(readFileSync("chains/chains.json", "utf8")) as { chains: Chain[] }).chains,
);

const failed: string[] = [];
for (const chain of chains) {
  console.log(`\n── ${chain.name} (${chain.id}) ──`);
  const ok = command === "verify" ? verify(chain) : runScript(command, chain);
  if (!ok) failed.push(chain.slug);
}

if (failed.length > 0) fail(`\nfailed: ${failed.join(", ")}`);

function selectChains(all: Chain[]): Chain[] {
  if (values.all) return all;
  if (values.network) return all.filter((chain) => chain.network === values.network);
  if (values.chain) {
    const unknown = values.chain.filter((slug) => !all.some((chain) => chain.slug === slug));
    if (unknown.length > 0) fail(`unknown chain: ${unknown.join(", ")}`);
    return all.filter((chain) => values.chain?.includes(chain.slug));
  }
  if (command === "status") return all;
  return fail("deploy and verify need --chain, --network or --all");
}

function rpcUrl(chain: Chain): string {
  return process.env[chain.rpcEnv] ?? chain.publicRpc;
}

function runScript(name: "status" | "deploy", chain: Chain): boolean {
  if (name === "status") {
    return forge(["script", "script/Status.s.sol", "--rpc-url", rpcUrl(chain)]);
  }

  const account = process.env.DEPLOYER_ACCOUNT ?? fail("DEPLOYER_ACCOUNT is not set");
  const deployed = forge([
    "script",
    "script/Deploy.s.sol",
    "--rpc-url",
    rpcUrl(chain),
    "--account",
    account,
    "--broadcast",
  ]);
  return deployed && verify(chain);
}

function verify(chain: Chain): boolean {
  const manifestPath = `deployments/${chain.id}.json`;
  if (!existsSync(manifestPath)) {
    console.log(`no manifest at ${manifestPath}; nothing to verify`);
    return true;
  }

  const { chainId: _, ...contracts } = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
    string,
    ManifestEntry
  >;
  const etherscanKey = process.env.ETHERSCAN_API_KEY;
  let ok = true;
  for (const [label, entry] of Object.entries(contracts)) {
    for (const verifier of chain.verifiers) {
      if (verifier === "etherscan" && !etherscanKey) {
        console.log(`skip etherscan for ${label}: ETHERSCAN_API_KEY is not set`);
        continue;
      }
      const args = [
        "verify-contract",
        entry.address,
        entry.artifact,
        "--chain",
        String(chain.id),
        "--verifier",
        verifier,
        "--watch",
      ];
      if (verifier === "etherscan" && etherscanKey) args.push("--etherscan-api-key", etherscanKey);
      ok = forge(args) && ok;
    }
  }
  return ok;
}

function forge(args: string[]): boolean {
  return spawnSync("forge", args, { stdio: "inherit" }).status === 0;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
