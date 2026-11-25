// A wagmi connector for an agent's grant: wagmi's actions and hooks (`sendCalls`, `getCallsStatus`, `signTypedData`,
// reads) go through `Grant.toProvider`, so the agent's account works where a wallet is expected. Copy it into an app;
// it isn't a published package. The SDK's chain tests drive it through wagmi against the devnet.
import { Grant } from "@namera-ai/sdk"
import { ChainNotConfiguredError, createConnector } from "@wagmi/core"
import { type Address, getAddress, numberToHex, SwitchChainError } from "viem"

/**
 * A connector for the agent's account under a grant, on the chain of `options.client`.
 *
 * @stability experimental
 */
export const namera = (options: Grant.toProvider.Options) => {
  let provider: Promise<Grant.toProvider.Provider> | undefined
  const getProvider = () => (provider ??= Grant.toProvider(options))
  const accounts = async () =>
    ((await (await getProvider()).request({ method: "eth_accounts" })) as ReadonlyArray<Address>).map((address) =>
      getAddress(address)
    )

  return createConnector<Grant.toProvider.Provider>((config) => ({
    id: "namera",
    name: "Namera grant",
    type: "namera",
    async connect(
      { chainId, withCapabilities }: { readonly chainId?: number | undefined; readonly withCapabilities?: boolean } = {}
    ) {
      const connected = await getProvider()
      const addresses = ((await connected.request({ method: "eth_requestAccounts" })) as ReadonlyArray<Address>).map(
        (address) => getAddress(address)
      )
      const current = await this.getChainId()
      if (chainId !== undefined && chainId !== current) await this.switchChain!({ chainId })
      return {
        accounts: (withCapabilities === true
          ? addresses.map((address) => ({ address, capabilities: {} }))
          : addresses) as never,
        chainId: current
      }
    },
    async disconnect() {},
    getAccounts: accounts,
    async getChainId() {
      return Number(await (await getProvider()).request({ method: "eth_chainId" }))
    },
    getProvider,
    // The grant is the authorization: the account reconnects without asking.
    async isAuthorized() {
      return true
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((entry) => entry.id === chainId)
      if (chain === undefined) throw new SwitchChainError(new ChainNotConfiguredError())
      await (await getProvider()).request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(chainId) }]
      })
      return chain
    },
    onAccountsChanged(addresses) {
      config.emitter.emit("change", { accounts: addresses.map((address) => getAddress(address)) })
    },
    onChainChanged(chainId) {
      config.emitter.emit("change", { chainId: Number(chainId) })
    },
    onDisconnect() {
      config.emitter.emit("disconnect")
    }
  }))
}
