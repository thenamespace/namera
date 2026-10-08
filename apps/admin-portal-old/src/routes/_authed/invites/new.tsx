import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Option, Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { Button, Field, FieldLabel, Input, Typography, toast } from "@namera-ai/ui";

import { asApiFailure, client, run } from "@/api/client";
import { LinkButton } from "@/components/link-button";
import { Timestamp } from "@/components/timestamp";

export const Route = createFileRoute("/_authed/invites/new")({ component: CreateInvitesScreen });

type Created = Awaited<ReturnType<typeof createInvites>>;
const createInvites = (payload: {
  count: number;
  expiresInDays: number;
  email?: typeof Email.Type;
}) => run(client.betaInvite.create({ payload }));

const decodeEmail = Schema.decodeUnknownOption(Email);

function CreateInvitesScreen() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const create = useMutation({
    mutationFn: createInvites,
    onSuccess: async (result) => {
      setCreated(result);
      await queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  const countValue = Number(count);
  const daysValue = Number(expiresInDays);
  const countInvalid = !Number.isInteger(countValue) || countValue < 1 || countValue > 50;
  const daysInvalid = !Number.isInteger(daysValue) || daysValue < 1 || daysValue > 30;
  const decodedEmail = email.trim() ? decodeEmail(email.trim()) : Option.none();
  const emailInvalid = email.trim().length > 0 && Option.isNone(decodedEmail);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (countInvalid || daysInvalid || emailInvalid) return;
    create.mutate({
      count: countValue,
      expiresInDays: daysValue,
      ...(Option.isSome(decodedEmail) ? { email: decodedEmail.value } : {}),
    });
  };

  const copyAll = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.invites.map((invite) => invite.url).join("\n"));
      toast.success("Links copied");
    } catch {
      toast.danger("Could not copy", {
        description: "Select the links and copy them manually.",
      });
    }
  };

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <Typography.Heading level={1} className="text-lg" weight="medium">
          Create invites
        </Typography.Heading>
        <Typography.Paragraph color="muted" size="sm">
          Each invite is single use. The code is shown once here and never again, so copy the links
          before leaving this screen.
        </Typography.Paragraph>
      </header>

      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex flex-wrap gap-4">
          <Field className="min-w-32 flex-1">
            <FieldLabel htmlFor="invite-count">How many (1 to 50)</FieldLabel>
            <Input
              id="invite-count"
              inputMode="numeric"
              fullWidth
              variant="secondary"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
            {countInvalid ? (
              <p className="text-danger text-sm" role="alert">
                Enter a whole number from 1 to 50.
              </p>
            ) : null}
          </Field>

          <Field className="min-w-32 flex-1">
            <FieldLabel htmlFor="invite-days">Valid for (1 to 30 days)</FieldLabel>
            <Input
              id="invite-days"
              inputMode="numeric"
              fullWidth
              variant="secondary"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
            />
            {daysInvalid ? (
              <p className="text-danger text-sm" role="alert">
                Enter a whole number of days from 1 to 30.
              </p>
            ) : null}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="invite-email">Lock to an email address (optional)</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            fullWidth
            variant="secondary"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {emailInvalid ? (
            <p className="text-danger text-sm" role="alert">
              That is not a valid email address.
            </p>
          ) : (
            <p className="text-muted text-sm">Leave this empty to let anyone redeem the code.</p>
          )}
        </Field>

        {create.isError ? (
          <p className="text-danger text-sm" role="alert">
            {asApiFailure(create.error).message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            isDisabled={create.isPending || countInvalid || daysInvalid || emailInvalid}
          >
            {create.isPending ? "Creating…" : "Create invites"}
          </Button>
          <LinkButton to="/invites" variant="tertiary">
            Back to invites
          </LinkButton>
        </div>
      </form>

      {created ? (
        <section
          aria-live="polite"
          className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4"
        >
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Typography.Heading level={2} className="text-base" weight="medium">
              {created.invites.length} {created.invites.length === 1 ? "invite" : "invites"} created
            </Typography.Heading>
            <Button variant="secondary" onPress={copyAll}>
              Copy all links
            </Button>
          </header>

          <ul className="flex flex-col gap-3">
            {created.invites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-1">
                <code className="text-base tracking-wider">{invite.code}</code>
                <span className="text-muted text-sm break-all">{invite.url}</span>
                <span className="text-muted text-sm">
                  Expires <Timestamp value={invite.expiresAt} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
