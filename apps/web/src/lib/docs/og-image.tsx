import {
  BotIcon,
  CommandLineIcon,
  DashboardSquare01Icon,
  Icon,
  NameraIcon,
  SourceCodeIcon,
} from "@namera-ai/ui/icons";

const sections = {
  docs: { name: "Documentation", color: "#a3a9ef", icon: DashboardSquare01Icon },
  dashboard: { name: "Dashboard", color: "#a3a9ef", icon: DashboardSquare01Icon },
  sdk: { name: "SDK", color: "#85bbdf", icon: SourceCodeIcon },
  cli: { name: "CLI", color: "#83c9b3", icon: CommandLineIcon },
  mcp: { name: "MCP", color: "#ddbf79", icon: BotIcon },
} as const;

type DocsOgImageProps = {
  readonly section: string;
  readonly title: string;
  readonly description?: string | undefined;
};

// Raster rendering has no document CSS; these colors mirror the docs section palette.
export function DocsOgImage({ section, title, description }: DocsOgImageProps) {
  const theme = sections[section as keyof typeof sections] ?? sections.docs;
  const displayTitle = title.length > 120 ? `${title.slice(0, 117)}…` : title;
  const displayDescription =
    description && description.length > 200 ? `${description.slice(0, 197)}…` : description;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#08090a",
        color: "#f7f8f8",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "58px 64px",
          background: "#08090a",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: 30,
            width: 660,
            height: 560,
            background: `radial-gradient(ellipse at center, ${theme.color}18 0%, ${theme.color}08 38%, ${theme.color}00 70%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 30,
            top: 160,
            opacity: 0.1,
          }}
        >
          <Icon icon={theme.icon} size={360} strokeWidth={1} color={theme.color} />
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            alignItems: "center",
            gap: 14,
            marginBottom: 60,
          }}
        >
          <NameraIcon width={25} height={21} fill="#f7f8f8" />
          <span style={{ fontSize: 28, fontWeight: 650, letterSpacing: -1 }}>Namera</span>
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              fontSize: displayTitle.length > 70 ? 44 : displayTitle.length > 42 ? 52 : 62,
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: -2,
              overflowWrap: "anywhere",
            }}
          >
            {displayTitle}
          </div>
          {displayDescription ? (
            <div
              style={{
                maxWidth: 680,
                fontSize: 27,
                lineHeight: 1.4,
                color: "#a5a8b1",
                marginTop: 22,
              }}
            >
              {displayDescription}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            alignItems: "center",
            gap: 10,
            color: theme.color,
            fontSize: 22,
            fontWeight: 550,
            marginTop: 32,
          }}
        >
          <Icon icon={theme.icon} size={24} color={theme.color} />
          {theme.name}
        </div>
      </div>
    </div>
  );
}
