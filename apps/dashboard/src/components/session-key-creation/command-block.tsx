import { CodeBlock, cn } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";

export function CommandBlock({
  command,
  label,
  className,
}: {
  command: string;
  label: string;
  className?: string;
}) {
  return (
    <CodeBlock
      className={cn(
        "min-w-0 max-w-full flex-row items-center gap-2 rounded-lg pr-2 [--font-mono:var(--font-geist-mono)]",
        className,
      )}
      aria-label={label}
    >
      <CodeBlock.Code
        code={command}
        language="bash"
        theme="github-dark-dimmed"
        darkTheme="github-dark-dimmed"
        className="min-w-0 flex-1 overflow-x-auto text-[13px]"
      />
      <CopyIconButton
        className="size-6 shrink-0 [&_svg]:size-3.5"
        label={label}
        tooltipLabel="Copy"
        value={command}
      />
    </CodeBlock>
  );
}
