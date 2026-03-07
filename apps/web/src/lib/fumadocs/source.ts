import { createElement } from "react";

import * as internalIcons from "@repo/ui/icons";
import { loader } from "fumadocs-core/source";
import { icons } from "lucide-react";

import { docs } from "fumadocs-mdx:collections/server";

import * as phosphorIcons from "./phosphor-icons";

export const source = loader({
  baseUrl: "/docs",
  icon: (icon) => {
    if (!icon) return;

    if (icon in internalIcons)
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: safe
      return createElement(internalIcons[icon as keyof typeof internalIcons]);
    if (icon in phosphorIcons)
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: safe
      return createElement(phosphorIcons[icon as keyof typeof phosphorIcons]);

    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);

    return;
  },
  plugins: [],
  source: docs.toFumadocsSource(),
});
