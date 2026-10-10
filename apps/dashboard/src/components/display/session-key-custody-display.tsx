import { BrandOneClawIcon, ComputerIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

export function SessionKeyCustodyDisplay({ custody }: { custody: "local" | "namera-managed" }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      {custody === "local" ? (
        <HugeiconsIcon aria-hidden className="size-4 shrink-0 text-muted" icon={ComputerIcon} />
      ) : (
        <BrandOneClawIcon aria-hidden className="size-4 shrink-0" />
      )}
      <span>{custody === "local" ? "Local key" : "1Claw Managed"}</span>
    </span>
  );
}
