import { createElement } from "react";

import {
  BookOpen01Icon,
  Download04Icon,
  HelpCircleIcon,
  Icon,
  Rocket01Icon,
} from "@namera-ai/ui/icons";
import { loader } from "fumadocs-core/source";

import { docs } from "../../../.source/server";

const pageIcons = new Map([
  ["BookOpen01Icon", BookOpen01Icon],
  ["HelpCircleIcon", HelpCircleIcon],
  ["Download04Icon", Download04Icon],
  ["Rocket01Icon", Rocket01Icon],
]);

export const docsSource = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon: (name) => {
    const icon = name ? pageIcons.get(name) : undefined;
    if (!icon) return;
    return createElement(Icon, { icon, "aria-hidden": true, className: "size-4" });
  },
});
