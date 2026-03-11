import { createElement } from "react";

import * as internalIcons from "@namera-ai/ui/icons";
import { loader } from "fumadocs-core/source";
import { icons as lucideIcons } from "lucide-react";

import { docs } from "fumadocs-mdx:collections/server";

import * as icons from "./icons";

export const source = loader({
  baseUrl: "/docs",
  icon: (icon) => {
    if (!icon) return;

    if (icon in internalIcons)
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: safe
      return createElement(internalIcons[icon as keyof typeof internalIcons]);
    if (icon in icons)
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: safe
      return createElement(icons[icon as keyof typeof icons]);

    if (icon in lucideIcons)
      return createElement(lucideIcons[icon as keyof typeof lucideIcons]);

    return;
  },
  plugins: [],
  source: docs.toFumadocsSource(),
});
