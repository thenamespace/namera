import * as twoslash from "fumadocs-twoslash/ui";
import * as accordionComponents from "fumadocs-ui/components/accordion";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import * as stepComponents from "fumadocs-ui/components/steps";
import * as tabsComponents from "fumadocs-ui/components/tabs";
import * as typeTable from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import * as files from "./files";
import * as mermaid from "./mermaid";
import * as sequenceAnimated from "./sequence-animated";

export function getMDXComponents(): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...sequenceAnimated,
    ...mermaid,
    ...files,
    ...tabsComponents,
    ...stepComponents,
    ...accordionComponents,
    ...twoslash,
    ...typeTable,
    img: (props) => <ImageZoom {...props} />,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props} className="shadow-none">
        <Pre className="text-sm font-geist-mono">{props.children}</Pre>
      </CodeBlock>
    ),
  };
}
