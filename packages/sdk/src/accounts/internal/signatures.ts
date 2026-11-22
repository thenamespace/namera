/**
 * A 65-byte ECDSA signature of the right shape for gas estimation: validators recover it to a random signer without
 * reverting, so the bundler can simulate validation.
 *
 * @internal
 */
export const DUMMY_ECDSA_SIGNATURE =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
