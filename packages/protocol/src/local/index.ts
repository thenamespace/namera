import { DateTime, Schema } from "effect";

import { SessionKeyId, SessionKeyInstallationId, SigningKeyId, WalletId } from "#/common/index";
import { EthereumAddress, EvmSessionEntityId, Hex, SupportedEvmChainId } from "#/evm/index";

/** Client-only artifacts. Never use these schemas as HTTP payloads or audit data. */
export const LocalEvmSessionBinding = Schema.Struct({
  walletId: WalletId,
  walletAddress: EthereumAddress,
  sessionKeyId: SessionKeyId,
  signingKeyId: SigningKeyId,
  installationId: SessionKeyInstallationId,
  chainId: SupportedEvmChainId,
  signerAddress: EthereumAddress,
  entityId: EvmSessionEntityId,
  isGlobal: Schema.Boolean,
  hasExecutionHooks: Schema.Boolean,
  allowSignatures: Schema.optional(Schema.Boolean),
  validAfter: Schema.DateTimeUtcFromString,
  validUntil: Schema.DateTimeUtcFromString,
}).check(
  Schema.makeFilter((binding) =>
    DateTime.toEpochMillis(binding.validUntil) > DateTime.toEpochMillis(binding.validAfter)
      ? undefined
      : "Session expiry must follow its start time",
  ),
);

const ApiOrigin = Schema.String.check(
  Schema.makeFilter((value) => {
    try {
      const url = new URL(value);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      return url.origin === value &&
        (url.protocol === "https:" || (url.protocol === "http:" && loopback))
        ? undefined
        : "Use an exact HTTPS API origin, or HTTP loopback for development";
    } catch {
      return "Invalid API origin";
    }
  }),
);

const Secp256k1PrivateKey = Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]{64}$/)).check(
  Schema.makeFilter((value) => {
    const scalar = BigInt(value);
    return scalar > 0n &&
      scalar < 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
      ? undefined
      : "Invalid secp256k1 scalar";
  }),
);

export const LocalSessionKeyMaterial = Schema.Struct({
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  apiOrigin: ApiOrigin,
  privateKey: Schema.RedactedFromValue(Secp256k1PrivateKey, { label: "local session key" }),
  bindings: Schema.Array(LocalEvmSessionBinding).check(Schema.isMinLength(1)),
}).check(
  Schema.makeFilter(({ bindings }) => {
    const first = bindings[0];
    if (first === undefined) return "At least one installation is required";
    const chains = new Set<string>();
    for (const binding of bindings) {
      if (chains.has(binding.chainId)) return "Duplicate chain installation";
      chains.add(binding.chainId);
      if (
        binding.walletId !== first.walletId ||
        binding.sessionKeyId !== first.sessionKeyId ||
        binding.signingKeyId !== first.signingKeyId ||
        binding.walletAddress.toLowerCase() !== first.walletAddress.toLowerCase() ||
        binding.signerAddress.toLowerCase() !== first.signerAddress.toLowerCase()
      )
        return "Installations must belong to one wallet and signing key";
    }
    return undefined;
  }),
);

export const EncryptedLocalSessionKey = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("namera-local-session-key"),
  encryption: Schema.Literal("AES-256-GCM"),
  kdf: Schema.Literal("PBKDF2-SHA256"),
  iterations: Schema.Literal(600_000),
  salt: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{22}$/)),
  iv: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{16}$/)),
  ciphertext: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{22,}$/)),
});

export type LocalEvmSessionBinding = typeof LocalEvmSessionBinding.Type;
export type LocalSessionKeyMaterial = typeof LocalSessionKeyMaterial.Type;
export type EncryptedLocalSessionKey = typeof EncryptedLocalSessionKey.Type;
