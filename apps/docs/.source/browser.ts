// @ts-nocheck
/// <reference types="vite/client" />
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
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
}>();
const browserCollections = {
  blog: create.doc("blog", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/blog",
    "query": {
      "collection": "blog"
    },
    "eager": false
  })),
  docs: create.doc("docs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/docs",
    "query": {
      "collection": "docs"
    },
    "eager": false
  })),
  miscDocuments: create.doc("miscDocuments", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/misc",
    "query": {
      "collection": "miscDocuments"
    },
    "eager": false
  })),
};
export default browserCollections;