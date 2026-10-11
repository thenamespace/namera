import type { EvmChainName, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { ChainIcon } from "@namera-ai/ui/icons";

import { InviteDate } from "../invites/invite-display";
import { chainNames, type CatalogRecord } from "./catalog-display";
import { CatalogCopyValue, CatalogProperty } from "./catalog-property";

const chains: Record<
  SupportedEvmChainId,
  { icon: EvmChainName; explorer: string; testnet: boolean }
> = {
  "eip155:1": { icon: "ethereum", explorer: "https://etherscan.io", testnet: false },
  "eip155:10": { icon: "optimism", explorer: "https://optimistic.etherscan.io", testnet: false },
  "eip155:8453": { icon: "base", explorer: "https://basescan.org", testnet: false },
  "eip155:42161": { icon: "arbitrum", explorer: "https://arbiscan.io", testnet: false },
  "eip155:11155111": { icon: "ethereum", explorer: "https://sepolia.etherscan.io", testnet: true },
  "eip155:11155420": {
    icon: "optimism",
    explorer: "https://sepolia-optimism.etherscan.io",
    testnet: true,
  },
  "eip155:84532": { icon: "base", explorer: "https://sepolia.basescan.org", testnet: true },
  "eip155:421614": { icon: "arbitrum", explorer: "https://sepolia.arbiscan.io", testnet: true },
};

export function CatalogDeployments({ entries }: { entries: CatalogRecord["entries"] }) {
  return (
    <section className="mt-10" aria-labelledby="catalog-deployments">
      <div className="mb-4 flex items-center gap-2">
        <h3 id="catalog-deployments" className="text-sm font-medium">
          Deployments
        </h3>
        <span className="text-muted text-xs">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-muted text-sm">No deployments added yet.</p>
      ) : null}
      <div className="grid gap-4">
        {entries.map((entry) => {
          const chain = chains[entry.chainId];
          const verification = entry.data.verification;
          return (
            <article key={entry.id} className="rounded-xl border border-separator p-4 sm:p-5">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ChainIcon
                    namespace="eip155"
                    chain={chain.icon}
                    className="size-7 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="text-sm font-medium">{chainNames[entry.chainId]}</h4>
                    <p className="text-muted text-xs">
                      {chain.testnet ? "Testnet" : "Mainnet"} · {entry.chainId}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs capitalize ${entry.status === "active" ? "text-success" : "text-muted"}`}
                >
                  {entry.status}
                </span>
              </header>
              <dl className="grid gap-2">
                <CatalogProperty label="Address">
                  <CatalogCopyValue
                    value={entry.address}
                    label={`${chainNames[entry.chainId]} address`}
                  />
                  <a
                    href={`${chain.explorer}/address/${entry.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent text-xs underline"
                  >
                    View on explorer ↗
                  </a>
                </CatalogProperty>
                {entry.data.type === "erc20" ? (
                  <CatalogProperty label="Decimals">{entry.data.decimals}</CatalogProperty>
                ) : null}
                <CatalogProperty label="Interface">
                  {entry.interfaceId ? (
                    <CatalogCopyValue value={entry.interfaceId} label="Interface ID" />
                  ) : (
                    <span className="text-muted">No ABI linked</span>
                  )}
                </CatalogProperty>
                <CatalogProperty label="Deployment ID">
                  <CatalogCopyValue value={entry.id} label="Deployment ID" />
                </CatalogProperty>
                {verification ? (
                  <>
                    <CatalogProperty label="Source">
                      <a
                        className="text-accent break-all underline"
                        href={verification.sourceUrl.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {verification.sourceUrl.hostname} ↗
                      </a>
                    </CatalogProperty>
                    <CatalogProperty label="Last checked">
                      <InviteDate label="Last checked" value={verification.checkedAt} />
                    </CatalogProperty>
                    {verification.implementationAddress ? (
                      <CatalogProperty label="Implementation">
                        <CatalogCopyValue
                          value={verification.implementationAddress}
                          label="Implementation address"
                        />
                      </CatalogProperty>
                    ) : null}
                  </>
                ) : (
                  <CatalogProperty label="Verification">
                    <span className="text-muted">No verification evidence supplied</span>
                  </CatalogProperty>
                )}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
