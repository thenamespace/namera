import { Typography } from "@namera-ai/ui";
import { useWatch, type Control } from "react-hook-form";

import { hasPermissions } from "@/components/permission";
import { useCurrentUser } from "@/hooks/auth";
import { useBilling } from "@/hooks/billing";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

function Capacity({ custody }: { custody: "local" | "namera-managed" }) {
  const billing = useBilling();
  const resource = billing.data?.resources.find(
    ({ key }) => key === (custody === "local" ? "local-session-keys" : "oneclaw-session-keys"),
  );
  if (!resource) return null;
  return (
    <Typography.Paragraph size="sm" color="muted" aria-live="polite">
      {resource.remainingAmount.toString()} of {resource.includedAmount.toString()}{" "}
      {custody === "local" ? "local" : "1Claw-managed"} session-key slots available.
    </Typography.Paragraph>
  );
}

export function CustodyCapacity({
  control,
}: {
  control: Control<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
}) {
  const user = useCurrentUser();
  const custody = useWatch({ control, name: "custody" });
  return hasPermissions(user.data?.role.permissions ?? [], ["billing:read"]) ? (
    <Capacity custody={custody} />
  ) : null;
}
