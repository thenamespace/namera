import { useState } from "react";

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { Button, Field, FieldLabel, Input, Typography } from "@namera-ai/ui";

import { asApiFailure, client, run } from "@/api/client";
import { MINIMUM_TOKEN_LENGTH, clearToken, readToken, writeToken } from "@/lib/session";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (readToken()) throw redirect({ to: "/invites" });
  },
  component: LoginScreen,
});

function LoginScreen() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const candidate = token.trim();
    if (candidate.length < MINIMUM_TOKEN_LENGTH) {
      setError(`The admin token is at least ${MINIMUM_TOKEN_LENGTH} characters long.`);
      return;
    }

    setIsChecking(true);
    // Store first so the client can read it, then probe the cheapest operator
    // read. A rejected probe clears the token, so a bad paste never lingers.
    writeToken(candidate);
    try {
      await run(client.adminUser.list({ query: { limit: 1 } }));
      await navigate({ to: "/invites" });
    } catch (cause) {
      clearToken();
      const failure = asApiFailure(cause);
      // Only a 401 means the token is wrong; a blocked request is not.
      setError(
        failure.kind === "unauthorized"
          ? "That token was rejected. Check it and try again."
          : `${failure.message} The token was not checked. (${failure.detail ?? "unknown"})`,
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <form className="flex w-full max-w-sm flex-col gap-6" onSubmit={submit} noValidate>
        <header className="flex flex-col gap-1.5">
          <Typography.Heading level={1} className="text-lg" weight="medium">
            Namera Operations
          </Typography.Heading>
          <Typography.Paragraph color="muted" size="sm">
            Paste the platform admin token. It is held for this tab only, and cleared when you close
            it.
          </Typography.Paragraph>
        </header>

        <Field>
          <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
          <Input
            id="admin-token"
            name="admin-token"
            type="password"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            fullWidth
            variant="secondary"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </Field>

        {error ? (
          <p className="text-danger text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" isDisabled={isChecking || token.trim().length === 0}>
          {isChecking ? "Checking…" : "Open the console"}
        </Button>
      </form>
    </main>
  );
}
