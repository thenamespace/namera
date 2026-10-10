import { BrandOneClawIcon, ComputerIcon, HugeiconsIcon, NameraIcon } from "@namera-ai/ui/icons";

export function SessionKeyCustodyDisplay({
  custody,
  provider = "1claw",
}: {
  custody: "local" | "namera-managed";
  provider?: "1claw" | "namera";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      {custody === "local" ? (
        <HugeiconsIcon aria-hidden className="size-4 shrink-0 text-muted" icon={ComputerIcon} />
      ) : provider === "1claw" ? (
        <BrandOneClawIcon aria-hidden className="size-4 shrink-0" />
      ) : (
        <NameraIcon aria-hidden className="size-4 shrink-0 fill-current" />
      )}
      <span>
        {custody === "local"
          ? "User Owned"
          : provider === "1claw"
            ? "1Claw Managed"
            : "Namera Managed"}
      </span>
    </span>
  );
}
