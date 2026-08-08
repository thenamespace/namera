export const cryptoPurpose = {
  magicLinkToken: "auth.magic-link.token",
  magicLinkCode: "auth.magic-link.code",
  sessionToken: "auth.session.token",
  emailOutbox: "email.outbox.payload",
} as const;

export type CryptoPurpose = (typeof cryptoPurpose)[keyof typeof cryptoPurpose];
