declare module "*.mdx" {
  import type { TOCItemType } from "fumadocs-core/toc";
  import type { MDXContent } from "mdx/types";

  export const toc: TOCItemType[];
  const Content: MDXContent;
  export default Content;
}
