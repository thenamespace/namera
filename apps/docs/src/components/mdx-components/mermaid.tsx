import { use, useEffect, useId, useState } from "react";

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return;
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(
  key: string,
  setPromise: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { default: mermaid } = use(
    cachePromise("mermaid", () => import("mermaid")),
  );

  const nodeBg = "#27272a";
  const nodeBorder = "#52525b";
  const clusterBg = "#3f3f46";
  const clusterBorder = "#52525b";

  mermaid.initialize({
    flowchart: {
      curve: "basis",
      htmlLabels: true,
      nodeSpacing: 40,
      padding: 12,
      rankSpacing: 40,
    },
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      clusterBkg: clusterBg,
      clusterBorder,
      edgeLabelBackground: nodeBg,
      fontFamily:
        'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      fontSize: "14px",
      lineColor: "#71717a",
      mainBkg: nodeBg,
      nodeBorder,
      primaryBorderColor: clusterBorder,
      primaryColor: clusterBg,
      primaryTextColor: "#e4e4e7",
      secondaryColor: nodeBg,
      tertiaryColor: clusterBg,
      titleColor: "#e4e4e7",
    },
  });

  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-dark`, () => {
      return mermaid.render(id, chart.replaceAll("\\n", "\n"));
    }),
  );

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: safe
      // biome-ignore lint/style/useNamingConvention: safe
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
    />
  );
}
