import { CodeBlock } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";

export function CommandBlock({ command, label }: { command: string; label: string }) {
  return (
    <CodeBlock
      className="min-w-0 max-w-full rounded-lg [--font-mono:var(--font-geist-mono)]"
      aria-label={label}
    >
      <CodeBlock.Header>
        <span className="text-muted text-[11px] leading-4">Bash</span>
        <CopyIconButton label={label} value={command} />
      </CodeBlock.Header>
      <CodeBlock.Code
        code={command}
        language="bash"
        theme="github-dark-dimmed"
        darkTheme="github-dark-dimmed"
        className="min-w-0 max-w-full overflow-x-auto text-[13px]"
      />
    </CodeBlock>
  );
}
