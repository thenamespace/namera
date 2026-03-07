/** biome-ignore-all lint/style/useNamingConvention: safe */

import * as accordionComponents from "fumadocs-ui/components/accordion";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import * as stepComponents from "fumadocs-ui/components/steps";
import * as tabsComponents from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import * as files from "./files";
import { Mermaid } from "./mermaid";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Mermaid,
    ...files,
    ...tabsComponents,
    ...stepComponents,
    ...accordionComponents,
    ...components,
    img: (props) => <ImageZoom {...props} />,
  };
}
