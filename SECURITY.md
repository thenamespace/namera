# Security policy

## Status: unaudited

Namera v2 (`@namera-ai/sdk` and `@namera-ai/contracts` 2.0.0 release candidates) is **unaudited**. The contracts and
the SDK have had internal security reviews only (automated multi-pass reviews and manual review, with every finding's
disposition recorded), and no external audit. There is **no bug bounty** for now. Use small amounts, and read the
documented limits before relying on a policy:

- "What the limits can't see" and "The fallback action" in the contracts README's
  [Policies](./contracts/README.md#policies) section;
- the [known limitations of the Smart Sessions fork](./contracts/src/smart-sessions/NOTICE.md#known-limitations).

A report of a behaviour that these documents already describe is welcome, but it is not a new vulnerability.

## Supported versions

| Version                                    | Supported                                        |
| ------------------------------------------ | ------------------------------------------------ |
| `2.0.0-rc.x`, the latest release candidate | Yes                                              |
| Earlier `2.0.0-rc` releases                | No: upgrade to the latest release candidate      |
| `1.x`                                      | Not covered by this policy (a separate codebase) |

The supported configuration is **Kernel 3.3 on EntryPoint v0.7**, deployed through its factory or on an EOA through
EIP-7702, on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia. Smart Sessions and `SessionHook` refuse to
install on any other account.

## Scope

In scope:

- **Contracts:** the Solidity sources in [`contracts/src/`](./contracts/src) and their deployments at the addresses
  `@namera-ai/contracts` lists: `SmartSession` (Namera's fork of Smart Sessions), `ECDSASessionValidator`,
  `WebAuthnValidator`, `SessionHook` and the policies. A session key, bundler, paymaster, relayer or target contract
  doing more than the owner's signed session allows is the core of the threat model.
- **SDK:** `@namera-ai/sdk`, including the pre-sign policy check, session compilation, grant parsing and verification,
  key stores, error redaction (keys, signatures and credentials in URLs must never reach errors, spans or JSON), and
  the EIP-1193 provider.
- **`@namera-ai/contracts`:** wrong ABIs, addresses or deployment records.
- **Release integrity:** the npm tarballs' contents, and documentation that leads to unsafe use.

Out of scope:

- accounts other than Kernel 3.3, other EntryPoint versions, and chains other than those above;
- vulnerabilities in Kernel, the EntryPoint, viem, ox, Effect or the bundlers and paymasters themselves (report them
  to their projects), unless Namera's use of them causes the issue;
- the upstream Smart Sessions deployments, which Namera doesn't use;
- a compromised owner key or passkey, a phished owner signature, and keys an application stores insecurely;
- denial of service against public infrastructure, spam, and loss of testnet funds.

## Report a vulnerability

Report privately, never in a public issue, pull request or discussion:

- **GitHub:** [private vulnerability reporting](https://github.com/thenamespace/namera/security/advisories/new);
- **Email:** `[PLACEHOLDER: security contact address, to be set by the maintainer before publishing]`.

Include the affected package or contract, its version or address and chain, a minimal reproduction (a Foundry test
or a script against a local devnet is ideal), what you expected and what happened, and the impact. Redact API keys,
tokens, credentials and personal data.

Test only on local chains, testnets, or mainnet accounts you own. Don't access other users' funds or data, don't
disrupt public services, and don't exploit a vulnerability beyond what proving it takes.

## Disclosure

- The maintainer investigates privately, keeps you informed, and coordinates the fix and its disclosure with you.
- Keep the details private until a fix is released, or for 90 days after your report, whichever comes first, unless
  we agree on another date. Deployed contracts are immutable, so a contract fix is a new deployment, and users need
  time to move to it: the agreed date may then be later.
- A fix is released as a new version with a GitHub security advisory, and you are credited unless you ask not to be.
- There is no bounty and no guaranteed response time.
