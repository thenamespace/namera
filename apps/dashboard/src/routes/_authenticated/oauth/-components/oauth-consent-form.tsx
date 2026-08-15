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
  ListBox,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { MetadataDisplay } from "@/components/display";
import {
  useApproveOAuthAuthorizationRequest,
  useDenyOAuthAuthorizationRequest,
} from "@/hooks/auth";

import { OAuthClientDetails } from "./oauth-client-details";

type OAuthConsentFormProps = {
  canAuthorize: boolean;
  organizationId: OrganizationId;
  request: GetOAuthAuthorizationRequestResponse;
  sessionKeys: ListSessionKeysForOrganizationResponse;
};

type OAuthConsentInput = typeof ApproveOAuthAuthorizationRequest.Encoded;
type OAuthConsentOutput = typeof ApproveOAuthAuthorizationRequest.Type;

export function OAuthConsentForm({
  canAuthorize,
  organizationId,
  request,
  sessionKeys,
}: OAuthConsentFormProps) {
  const approve = useApproveOAuthAuthorizationRequest();
  const deny = useDenyOAuthAuthorizationRequest();
  const activeSessionKeys = useMemo(
    () => sessionKeys.filter(({ status }) => status === "active"),
    [sessionKeys],
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
  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      const response = await approve.mutateAsync({ payload });
      window.location.assign(response.redirectUrl);
    } catch {
      toast.danger("Couldn't authorize this client.");
    }
  });
  const handleDeny = async () => {
    try {
      const response = await deny.mutateAsync({ payload: { requestId: request.id } });
      window.location.assign(response.redirectUrl);
    } catch {
      toast.danger("Couldn't deny this request.");
    }
  };

  return (
    <form id="oauth-consent-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot className="p-0">
        <DashboardCardContent className="divide-y-0 p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <Avatar className="mb-4 size-12">
              {request.client.logoUri === null ? null : (
                <Avatar.Image alt="" src={request.client.logoUri} />
              )}
              <Avatar.Fallback>
                {request.client.clientName.slice(0, 1).toUpperCase()}
              </Avatar.Fallback>
            </Avatar>
            <Typography.Heading className="text-balance text-xl" level={1} weight="medium">
              Authorize {request.client.clientName}
            </Typography.Heading>
            <Typography.Paragraph
              className="mt-2 max-w-sm text-pretty text-center"
              color="muted"
              size="sm"
            >
              Choose the session keys this client may use. You can revoke this access later.
            </Typography.Paragraph>
            {request.client.clientUri === null ? null : (
              <Typography.Paragraph className="mt-2 truncate" color="muted" size="xs">
                {request.client.clientUri}
              </Typography.Paragraph>
            )}
          </div>

          <OAuthClientDetails
            clientId={request.client.clientId}
            redirectUri={request.redirectUri}
            scopes={request.requestedScopes}
          />

          {canAuthorize ? (
            <FieldGroup className="mt-7">
              <Controller
                control={form.control}
                name="sessionKeyIds"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="grid gap-1">
                      <FieldLabel id="oauth-session-keys-label">Session keys</FieldLabel>
                      <Typography.Paragraph color="muted" size="xs">
                        The client can act only through the keys selected here.
                      </Typography.Paragraph>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Select<(typeof activeSessionKeys)[number], "multiple">
                      aria-labelledby="oauth-session-keys-label"
                      fullWidth
                      isInvalid={fieldState.invalid}
                      name={field.name}
                      selectionMode="multiple"
                      value={field.value}
                      variant="secondary"
                      onChange={field.onChange}
                    >
                      <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                        <Select.Value>
                          {field.value.length === 0
                            ? "Select session keys"
                            : `${field.value.length} session key${field.value.length === 1 ? "" : "s"} selected`}
                        </Select.Value>
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox items={activeSessionKeys}>
                          {(sessionKey) => (
                            <ListBox.Item id={sessionKey.id} textValue={sessionKey.metadata.name}>
                              <MetadataDisplay
                                fallbackName="Unnamed session key"
                                metadata={sessionKey.metadata}
                              />
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
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
            <Typography.Paragraph className="mt-7" color="muted" size="sm">
              Your workspace role cannot grant session keys to this client. You can deny the
              request.
            </Typography.Paragraph>
          )}

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Button
              fullWidth
              isDisabled={isPending}
              type="button"
              variant="secondary"
              onPress={handleDeny}
            >
              Deny
            </Button>
            <Button
              form="oauth-consent-form"
              fullWidth
              isDisabled={isPending || !canAuthorize || activeSessionKeys.length === 0}
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
