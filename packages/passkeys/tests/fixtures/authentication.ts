import {
  createTestAuthenticator,
  type TestAuthenticationInput,
} from "../../src/testing/authenticator.js";

export const authenticationFixture = (input: TestAuthenticationInput) => {
  const authenticator = createTestAuthenticator();
  return { publicKeyHex: authenticator.publicKeyHex, response: authenticator.authenticate(input) };
};
