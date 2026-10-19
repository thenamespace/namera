import { BrandClaudeIcon, BrandOpenaiIcon } from "@namera-ai/ui/icons";

export const mcpClients = [
  {
    id: "codex",
    name: "Codex",
    icon: BrandOpenaiIcon,
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "codex mcp add namera -- namera mcp serve --profile codex",
  },
  {
    id: "claude",
    name: "Claude Code",
    icon: BrandClaudeIcon,
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    logo: "/icons/mcp/gemini.svg",
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "gemini mcp add --scope user --transport stdio namera namera mcp serve -- --profile gemini",
  },
] as const;
