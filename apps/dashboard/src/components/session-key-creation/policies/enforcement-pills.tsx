import { Chip } from "@namera-ai/ui";

export function EnforcementPills({ api = false }: { api?: boolean }) {
  return (
    <div className="mr-auto flex items-center gap-1.5 self-center">
      <Chip size="sm" variant="soft">
        <Chip.Label className="font-normal">Onchain</Chip.Label>
      </Chip>
      {api ? (
        <Chip size="sm" variant="soft">
          <Chip.Label className="font-normal">API</Chip.Label>
        </Chip>
      ) : null}
    </div>
  );
}
