// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { OrganizationId } from "@namera-ai/protocol";
import {
  ApproveOAuthDeviceAuthorizationRequest,
  type ListSessionKeysForOrganizationResponse,
  type OAuthDeviceAuthorizationResponse,
} from "@namera-ai/protocol/dto";
import {
  Avatar,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Surface,
  Typography,
} from "@namera-ai/ui";
import {
  BotIcon,
  CheckmarkCircle02Icon,
  ConnectIcon,
  HugeiconsIcon,
  NameraIcon,
} from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { SessionKeySelect } from "@/components/session-key-select";
import { useApproveOAuthDeviceAuthorization, useDenyOAuthDeviceAuthorization } from "@/hooks/auth";
import { showErrorToast } from "@/lib/toasts";

type Input = typeof ApproveOAuthDeviceAuthorizationRequest.Encoded;
type Output = typeof ApproveOAuthDeviceAuthorizationRequest.Type;

type CliConsentFormProps = {
  canAuthorize: boolean;
  organizationId: OrganizationId;
  request: OAuthDeviceAuthorizationResponse;
  sessionKeys: ListSessionKeysForOrganizationResponse;
};

function requestedCapabilities(scopes: ReadonlyArray<string>): ReadonlyArray<string> {
  const requested = new Set(scopes);
  const capabilities: string[] = [];

  if (requested.has("wallet:read")) capabilities.push("Read wallets and account details");
  if (requested.has("session-key:read")) {
    capabilities.push("Read session keys and their policies");
  }
  if (requested.has("execution:read")) {
    capabilities.push("Read execution history and status");
  }
  if (requested.has("execution:execute") || requested.has("signature:create")) {
    capabilities.push("Execute transactions, sign messages, and sign typed data");
  }
  if (requested.has("offline_access")) {
    capabilities.push("Stay signed in until you revoke access");
  }

  return capabilities;
}

export function CliConsentForm({
  canAuthorize,
  organizationId,
  request,
  sessionKeys,
}: CliConsentFormProps) {
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);
  const approve = useApproveOAuthDeviceAuthorization({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t authorize CLI",
        description: "Review the selected session keys and try again.",
      }),
    onSuccess: () => setDecision("approved"),
  });
  const deny = useDenyOAuthDeviceAuthorization({
    onError: (error) =>
      showErrorToast(error, { title: "Couldn’t reject request", description: "Try again." }),
    onSuccess: () => setDecision("denied"),
  });
  const activeSessionKeys = useMemo(
    () => sessionKeys.filter(({ status }) => status === "active"),
    [sessionKeys],
  );
  const capabilities = useMemo(
    () => requestedCapabilities(request.requestedScopes),
    [request.requestedScopes],
  );
  const form = useForm<Input, unknown, Output>({
    defaultValues: {
      deviceAuthorizationId: request.id,
      organizationId,
      sessionKeyIds: [],
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(ApproveOAuthDeviceAuthorizationRequest),
    ),
  });

  if (decision !== null) {
    return (
      <DashboardCardRoot className="p-0">
        <DashboardCardContent className="divide-y-0 p-7 text-center">
          <Typography.Heading className="text-xl" level={1} weight="medium">
            {decision === "approved" ? "CLI authorized" : "Request rejected"}
          </Typography.Heading>
          <Typography.Paragraph className="mt-2" color="muted" size="sm">
            {decision === "approved"
              ? "Return to your terminal. The CLI will finish signing in automatically."
              : "You can close this page and return to your terminal."}
          </Typography.Paragraph>
        </DashboardCardContent>
      </DashboardCardRoot>
    );
  }

  const pending = approve.isPending || deny.isPending;

  return (
    <form
      id="cli-consent-form"
      noValidate
      onSubmit={form.handleSubmit((payload) => approve.mutate({ payload }))}
    >
      <DashboardCardRoot className="overflow-hidden p-0">
        <DashboardCardContent className="divide-y-0 p-6">
          <header className="flex flex-col items-center text-center">
            <div className="mb-4 flex items-center gap-3" aria-hidden="true">
              <Surface
                className="bg-background flex size-12 items-center justify-center rounded-md p-0 shadow-xs"
                variant="secondary"
              >
                <Avatar className="size-12 rounded-md bg-transparent">
                  {request.client.logoUri === null ? null : (
                    <Avatar.Image alt="" src={request.client.logoUri} />
                  )}
                  <Avatar.Fallback>
                    <HugeiconsIcon className="size-6" icon={BotIcon} />
                  </Avatar.Fallback>
                </Avatar>
              </Surface>
              <span className="text-content-tertiary flex size-6 items-center justify-center">
                <HugeiconsIcon className="size-5" icon={ConnectIcon} />
              </span>
              <Surface
                className="bg-background flex size-12 items-center justify-center rounded-md p-0 shadow-xs"
                variant="secondary"
              >
                <NameraIcon className="fill-foreground h-6 w-auto" />
              </Surface>
            </div>
            <Typography.Heading className="text-balance text-xl" level={1} weight="medium">
              {request.client.clientName} is requesting access
            </Typography.Heading>
            <Typography.Paragraph
              className="mt-2 max-w-md text-pretty text-center"
              color="muted"
              size="xs"
            >
              Sign in on {request.deviceName} using only the accounts and session keys you choose.
            </Typography.Paragraph>
          </header>

          <section className="mt-6" aria-labelledby="cli-capabilities-heading">
            <Typography.Heading
              className="text-sm"
              id="cli-capabilities-heading"
              level={2}
              weight="medium"
            >
              By granting access, this CLI will be able to
            </Typography.Heading>
            <Surface className="mt-2 rounded-xl p-0" variant="secondary">
              <ul className="divide-separator divide-y">
                {capabilities.map((capability) => (
                  <li className="flex items-center gap-2 py-1.5" key={capability}>
                    <HugeiconsIcon
                      className="size-4 shrink-0 text-success"
                      icon={CheckmarkCircle02Icon}
                    />
                    <Typography.Paragraph color="muted" size="sm">
                      {capability}
                    </Typography.Paragraph>
                  </li>
                ))}
              </ul>
            </Surface>
          </section>

          {canAuthorize ? (
            <FieldGroup className="mt-6">
              <Controller
                control={form.control}
                name="sessionKeyIds"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-1">
                      <FieldLabel id="cli-session-keys-label">Accounts and session keys</FieldLabel>
                      <Typography.Paragraph color="muted" size="xs">
                        Select the account authorities this CLI may use. Each request must still
                        satisfy the chosen key's policies.
                      </Typography.Paragraph>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <SessionKeySelect
                      aria-labelledby="cli-session-keys-label"
                      isInvalid={fieldState.invalid}
                      name={field.name}
                      sessionKeys={activeSessionKeys}
                      triggerRef={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
            </FieldGroup>
          ) : (
            <Typography.Paragraph className="mt-6" color="muted" size="sm">
              Your workspace role cannot grant session keys to this CLI. You can reject the request.
            </Typography.Paragraph>
          )}

          <section className="mt-6" aria-labelledby="cli-details-heading">
            <Typography.Heading
              className="text-sm"
              id="cli-details-heading"
              level={2}
              weight="medium"
            >
              Connection details
            </Typography.Heading>
            <Surface className="mt-3 overflow-hidden rounded-xl p-0" variant="secondary">
              <dl className="divide-separator divide-y">
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <dt className="text-content-tertiary text-xs">Device</dt>
                  <dd className="text-content-secondary truncate text-xs">{request.deviceName}</dd>
                </div>
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <dt className="text-content-tertiary text-xs">Environment</dt>
                  <dd className="text-content-secondary truncate text-xs">
                    {request.platform} · CLI {request.cliVersion}
                  </dd>
                </div>
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <dt className="text-content-tertiary text-xs">Verification code</dt>
                  <dd>
                    <code className="text-content-secondary text-xs tracking-wider">
                      {request.userCode}
                    </code>
                  </dd>
                </div>
              </dl>
            </Surface>
          </section>

          <Typography.Paragraph className="mt-5 text-center" color="muted" size="xs">
            Make sure the verification code matches your terminal. You can revoke this CLI later
            from workspace settings.
          </Typography.Paragraph>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              fullWidth
              isDisabled={pending}
              type="button"
              variant="tertiary"
              onPress={() => deny.mutate({ payload: { deviceAuthorizationId: request.id } })}
            >
              Reject
            </Button>
            <Button
              form="cli-consent-form"
              fullWidth
              isDisabled={pending || !canAuthorize || activeSessionKeys.length === 0}
              type="submit"
            >
              {approve.isPending ? "Approving…" : "Approve access"}
            </Button>
          </div>
        </DashboardCardContent>
      </DashboardCardRoot>
    </form>
  );
}

export type { CliConsentFormProps };
