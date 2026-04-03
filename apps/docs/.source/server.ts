// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
} & {
  DocData: {
    blog: {
      /**
       * Last modified date of document file, obtained from version control.
       *
       */
      lastModified?: Date;
    },
    docs: {
      /**
       * Last modified date of document file, obtained from version control.
       *
       */
      lastModified?: Date;
    },
    miscDocuments: {
      /**
       * Last modified date of document file, obtained from version control.
       *
       */
      lastModified?: Date;
    },
  }
}>({"doc":{"passthroughs":["extractedReferences","lastModified"]}});

export const blog = await create.docs("blog", "content/blog", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/blog",
  "query": {
    "collection": "blog"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/blog",
  "query": {
    "collection": "blog"
  },
  "eager": true
}));

export const docs = await create.docs("docs", "content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs",
  "query": {
    "collection": "docs"
  },
  "eager": true
}));

export const miscDocuments = await create.docs("miscDocuments", "content/misc", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/misc",
  "query": {
    "collection": "miscDocuments"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/misc",
  "query": {
    "collection": "miscDocuments"
  },
  "eager": true
}));