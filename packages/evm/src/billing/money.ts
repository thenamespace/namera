const microUsdScale = 1_000_000n;
const basisPointScale = 10_000n;

export const decimalUsdToMicroUsd = (value: string): bigint => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid USD price");
  const [whole = "0", fraction = ""] = value.split(".");
  const padded = `${fraction}000000`.slice(0, 6);
  const truncated = BigInt(whole) * microUsdScale + BigInt(padded);
  // A quote can contain more precision than the ledger's micro-USD unit.
  // Round upward so a reservation never understates sponsored cost.
  return truncated + (/[1-9]/.test(fraction.slice(6)) ? 1n : 0n);
};

export const nativeWeiToMicroUsd = (input: {
  readonly amountWei: bigint;
  readonly nativePriceMicroUsd: bigint;
  readonly surchargeBasisPoints: number;
}): bigint => {
  const numerator =
    input.amountWei *
    input.nativePriceMicroUsd *
    (basisPointScale + BigInt(input.surchargeBasisPoints));
  const denominator = 10n ** 18n * basisPointScale;
  return (numerator + denominator - 1n) / denominator;
};
