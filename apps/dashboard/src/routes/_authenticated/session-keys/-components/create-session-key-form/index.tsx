import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateSessionKeyRequest, type ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, toast } from "@namera-ai/ui";
import { useForm, type DefaultValues } from "react-hook-form";

import { useCreateSessionKey } from "@/hooks/session-key";

import { SessionKeyDetailsCard } from "./details-card";
import { PolicySection } from "./policies";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

const defaultLogo: MetadataIcon = { type: "emoji", value: "🔑" };
const defaultValues = {
  namespace: "eip155",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
    description: "",
  },
  policies: [],
} satisfies DefaultValues<CreateSessionKeyFormInput>;

type CreateSessionKeyFormProps = {
  wallets: ListWalletsResponse;
};

export function CreateSessionKeyForm({ wallets }: CreateSessionKeyFormProps) {
  const createSessionKey = useCreateSessionKey();
  const navigate = useNavigate();
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyRequest)),
  });
  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      await createSessionKey.mutateAsync({ payload });
      toast.success("Session key created");
      await navigate({ to: "/session-keys", replace: true });
    } catch {
      toast.danger("Couldn't create the session key.");
    }
  });

  return (
    <form id="create-session-key-form" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-8">
        <SessionKeyDetailsCard control={form.control} wallets={wallets} />
        <PolicySection form={form} wallets={wallets} />
      </div>

      <Button
        className="mt-4"
        form="create-session-key-form"
        fullWidth
        isDisabled={createSessionKey.isPending}
        type="submit"
      >
        {createSessionKey.isPending ? "Creating…" : "Create session key"}
      </Button>
    </form>
  );
}
