// oxlint-disable react-perf/jsx-no-new-function-as-prop
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
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { SessionKeySelect } from "@/components/session-key-select";
import { useApproveOAuthDeviceAuthorization, useDenyOAuthDeviceAuthorization } from "@/hooks/auth";
import { showErrorToast } from "@/lib/toasts";

type Input = typeof ApproveOAuthDeviceAuthorizationRequest.Encoded;
type Output = typeof ApproveOAuthDeviceAuthorizationRequest.Type;

export function CliConsentForm({
  canAuthorize,
  organizationId,
  request,
  sessionKeys,
}: {
  readonly canAuthorize: boolean;
  readonly organizationId: OrganizationId;
  readonly request: OAuthDeviceAuthorizationResponse;
  readonly sessionKeys: ListSessionKeysForOrganizationResponse;
}) {
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
      showErrorToast(error, { title: "Couldn’t deny request", description: "Try again." }),
    onSuccess: () => setDecision("denied"),
  });
  const activeSessionKeys = useMemo(
    () =>
      (Array.isArray(sessionKeys) ? sessionKeys : []).filter(({ status }) => status === "active"),
    [sessionKeys],
  );
  const requestedScopes = useMemo(
    () => (Array.isArray(request.requestedScopes) ? request.requestedScopes : []),
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
      <div className="text-center">
        <Typography.Heading className="text-xl" level={1} weight="medium">
          {decision === "approved" ? "CLI authorized" : "Request denied"}
        </Typography.Heading>
        <Typography.Paragraph className="mt-2" color="muted" size="sm">
          {decision === "approved"
            ? "Return to your terminal. The CLI will finish signing in automatically."
            : "You can close this page and return to your terminal."}
        </Typography.Paragraph>
      </div>
    );
  }

  const pending = approve.isPending || deny.isPending;
  return (
    <form
      id="cli-consent-form"
      noValidate
      onSubmit={form.handleSubmit((payload) => approve.mutate({ payload }))}
    >
      <DashboardCardRoot className="p-0">
        <DashboardCardContent className="divide-y-0 p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <Avatar className="mb-4 size-12">
              <Avatar.Fallback>N</Avatar.Fallback>
            </Avatar>
            <Typography.Heading className="text-xl" level={1} weight="medium">
              Authorize {request.deviceName}
            </Typography.Heading>
            <Typography.Paragraph className="mt-2 max-w-sm" color="muted" size="sm">
              Confirm the code shown in your terminal, then choose the session keys this CLI may
              use.
            </Typography.Paragraph>
            <Typography.Code className="mt-4 text-lg">{request.userCode}</Typography.Code>
          </div>

          <div className="mt-6 grid gap-3">
            <Typography.Paragraph color="muted" size="xs">
              {request.platform} · CLI {request.cliVersion}
            </Typography.Paragraph>
            <div aria-label="Requested access" className="flex flex-wrap gap-2">
              {requestedScopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-md border border-divider/80 bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {canAuthorize ? (
            <FieldGroup className="mt-7">
              <Controller
                control={form.control}
                name="sessionKeyIds"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-1">
                      <FieldLabel id="cli-session-keys-label">Accounts and session keys</FieldLabel>
                      <Typography.Paragraph color="muted" size="xs">
                        Every transaction and signature must pass one selected key’s policies.
                      </Typography.Paragraph>
                      {fieldState.invalid ? (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      ) : null}
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
            <Typography.Paragraph className="mt-7" color="muted" size="sm">
              Your role cannot authorize CLI access for this workspace.
            </Typography.Paragraph>
          )}

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Button
              fullWidth
              isDisabled={pending}
              type="button"
              variant="secondary"
              onPress={() => deny.mutate({ payload: { deviceAuthorizationId: request.id } })}
            >
              Deny
            </Button>
            <Button
              form="cli-consent-form"
              fullWidth
              isDisabled={pending || !canAuthorize || activeSessionKeys.length === 0}
              type="submit"
            >
              {approve.isPending ? "Authorizing…" : "Authorize"}
            </Button>
          </div>
        </DashboardCardContent>
      </DashboardCardRoot>
    </form>
  );
}
