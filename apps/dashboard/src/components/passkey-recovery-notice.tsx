import { Alert } from "@namera-ai/ui";

export function PasskeyRecoveryNotice() {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Your passkey is the only owner key</Alert.Title>
        <Alert.Description>
          Namera cannot reset or replace it. Losing access to every copy can permanently lock funds
          and prevent you from removing onchain session permissions. Signing in to Namera by email
          does not restore your passkey.
        </Alert.Description>
        <Alert.Description>
          Check your passkey provider’s backup and recovery options before funding this account.
          Existing session keys may retain their permissions, but they are not a recovery key.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
