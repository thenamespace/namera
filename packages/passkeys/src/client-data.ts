import { decodeClientDataJSON } from "@simplewebauthn/server/helpers";

/** Wallet ceremonies are first-party, including browsers that omit topOrigin. */
export const assertFirstPartyClientData = (encodedClientData: string): void => {
  const clientData = decodeClientDataJSON(encodedClientData);
  if (clientData.crossOrigin === true || clientData.topOrigin !== undefined)
    throw new Error("Cross-origin wallet ceremonies are not allowed");
};
