// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { OrganizationId } from "@namera-ai/protocol";
import {
  ApproveOAuthAuthorizationRequest,
  type GetOAuthAuthorizationRequestResponse,
  type ListSessionKeysForOrganizationResponse,
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
import {
  useApproveOAuthAuthorizationRequest,
  useDenyOAuthAuthorizationRequest,
} from "@/hooks/auth";
import { showErrorToast } from "@/lib/toasts";

import { OAuthClientDetails } from "./oauth-client-details";

type OAuthConsentFormProps = {
  canAuthorize: boolean;
  organizationId: OrganizationId;
  request: GetOAuthAuthorizationRequestResponse;
  sessionKeys: ListSessionKeysForOrganizationResponse;
};

type OAuthConsentInput = typeof ApproveOAuthAuthorizationRequest.Encoded;
type OAuthConsentOutput = typeof ApproveOAuthAuthorizationRequest.Type;

function requestedCapabilities(scopes: ReadonlyArray<string>): ReadonlyArray<string> {
  const requested = new Set(scopes);
  const capabilities: string[] = [];

  if (requested.has("mcp:read") || requested.has("wallet:read")) {
    capabilities.push("Read wallets and account details");
  }
  if (requested.has("mcp:read") || requested.has("session-key:read")) {
    capabilities.push("Read session keys and their policies");
  }
  if (requested.has("mcp:read") || requested.has("execution:read")) {
    capabilities.push("Read execution history and status");
  }
  if (
    requested.has("mcp:execute") ||
    requested.has("execution:execute") ||
    requested.has("signature:create")
  ) {
    capabilities.push("Execute transactions, sign messages, and sign typed data");
  }
  if (requested.has("offline_access")) {
    capabilities.push("Stay connected until you revoke access");
  }

  return capabilities;
}

export function OAuthConsentForm({
  canAuthorize,
  organizationId,
  request,
  sessionKeys,
}: OAuthConsentFormProps) {
  const approve = useApproveOAuthAuthorizationRequest({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t authorize client",
        description: "Review the requested access and try again.",
      }),
    onSuccess: (response) => window.location.assign(response.redirectUrl),
  });
  const deny = useDenyOAuthAuthorizationRequest({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t deny request",
        description: "Try again before closing this page.",
      }),
    onSuccess: (response) => window.location.assign(response.redirectUrl),
  });
  const activeSessionKeys = useMemo(
    () => sessionKeys.filter(({ status }) => status === "active"),
    [sessionKeys],
  );
  const capabilities = useMemo(
    () => requestedCapabilities(request.requestedScopes),
    [request.requestedScopes],
  );
  const form = useForm<OAuthConsentInput, unknown, OAuthConsentOutput>({
    defaultValues: {
      requestId: request.id,
      organizationId,
      sessionKeyIds: [],
      expiresAt: null,
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ApproveOAuthAuthorizationRequest)),
  });
  const isPending = approve.isPending || deny.isPending;
  const handleSubmit = form.handleSubmit((payload) => {
    approve.mutate({ payload });
  });
  const handleDeny = () => {
    deny.mutate({ payload: { requestId: request.id } });
  };

  return (
    <form id="oauth-consent-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot className="overflow-hidden p-0">
        <DashboardCardContent className="divide-y-0 p-6">
          <header className="flex flex-col items-center text-center">
            <div className="mb-4 flex items-center gap-3" aria-hidden="true">
              <Surface
                className="bg-background flex size-12 items-center justify-center rounded-md p-0 shadow-xs"
                variant="secondary"
              >
                <Avatar className="size-12 bg-transparent rounded-md">
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
              Connect {request.client.clientName} to Namera using only the accounts and session keys
              you choose.
            </Typography.Paragraph>
            {request.client.clientUri === null ? null : (
              <Typography.Paragraph className="mt-2 max-w-full truncate" color="muted" size="xs">
                {request.client.clientUri}
              </Typography.Paragraph>
            )}
          </header>

          <section className="mt-6" aria-labelledby="oauth-capabilities-heading">
            <Typography.Heading
              className="text-sm"
              id="oauth-capabilities-heading"
              level={2}
              weight="medium"
            >
              By granting access, this connection will be able to
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
                      <FieldLabel id="oauth-session-keys-label">
                        Accounts and session keys
                      </FieldLabel>
                      <Typography.Paragraph color="muted" size="xs">
                        Select the account authorities this connection may use. Each request must
                        still satisfy the chosen key's policies.
                      </Typography.Paragraph>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <SessionKeySelect
                      aria-labelledby="oauth-session-keys-label"
                      isInvalid={fieldState.invalid}
                      name={field.name}
                      sessionKeys={activeSessionKeys}
                      triggerRef={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                    {activeSessionKeys.length === 0 ? (
                      <Typography.Paragraph color="muted" size="xs">
                        This workspace has no active session keys to grant.
                      </Typography.Paragraph>
                    ) : null}
                  </Field>
                )}
              />
            </FieldGroup>
          ) : (
            <Typography.Paragraph className="mt-6" color="muted" size="sm">
              Your workspace role cannot grant session keys to this client. You can reject the
              request.
            </Typography.Paragraph>
          )}

          <section className="mt-6" aria-labelledby="oauth-details-heading">
            <Typography.Heading
              className="text-sm"
              id="oauth-details-heading"
              level={2}
              weight="medium"
            >
              Connection details
            </Typography.Heading>
            <OAuthClientDetails
              clientId={request.client.clientId}
              redirectUri={request.redirectUri}
            />
          </section>

          <Typography.Paragraph className="mt-5 text-center" color="muted" size="xs">
            You can revoke this connection later from workspace settings.
          </Typography.Paragraph>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              fullWidth
              isDisabled={isPending}
              type="button"
              variant="tertiary"
              onPress={handleDeny}
            >
              Reject
            </Button>
            <Button
              form="oauth-consent-form"
              fullWidth
              isDisabled={isPending || !canAuthorize || activeSessionKeys.length === 0}
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
