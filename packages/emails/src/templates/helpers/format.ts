export const formatEmailCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export const formatEvmAddress = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;
