import { createFileRoute } from "@tanstack/react-router";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { Document, type DocumentData } from "flexsearch";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { source } from "@/lib/source";

interface CustomDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
}

export type ChatUIMessage = UIMessage<
  never,
  {
    client: {
      location: string;
    };
  }
>;

const searchServer = createSearchServer();

async function createSearchServer() {
  const search = new Document<CustomDocument>({
    document: {
      id: "url",
      index: ["title", "description", "content"],
      store: true,
    },
  });

  const docs = await chunkedAll(
    source.getPages().map(async (page) => {
      if (!("getText" in page.data)) return null;

      return {
        content: await page.data.getText("processed"),
        description: page.data.description,
        title: page.data.title,
        url: page.url,
      } as CustomDocument;
    }),
  );

  for (const doc of docs) {
    if (doc) search.add(doc);
  }

  return search;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
  const SIZE = 50;
  const out: O[] = [];
  for (let i = 0; i < promises.length; i += SIZE) {
    // biome-ignore lint/performance/noAwaitInLoops: safe
    out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
  }
  return out;
}

const openrouter = createOpenRouter({
  apiKey: serverEnv.openRouterApiKey,
});

const systemPrompt = [
  "You are Namera AI, an AI assistant for a Namera documentation site.",
  "Use the `search` tool to retrieve relevant docs context before answering when needed.",
  "The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.",
  "If you cannot find the answer in search results, say you do not know and suggest a better search query.",
].join("\n");

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        const req = ctx.request;
        const reqJson = await req.json();

        const result = streamText({
          messages: [
            { content: systemPrompt, role: "system" },
            ...(await convertToModelMessages<ChatUIMessage>(
              reqJson.messages ?? [],
              {
                convertDataPart(part) {
                  if (part.type === "data-client")
                    return {
                      text: `[Client Context: ${JSON.stringify(part.data)}]`,
                      type: "text",
                    };

                  return;
                },
              },
            )),
          ],
          model: openrouter.chat(serverEnv.openRouterModel),
          stopWhen: stepCountIs(5),
          toolChoice: "auto",
          tools: {
            search: searchTool,
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});

export type SearchTool = typeof searchTool;

const searchTool = tool({
  description: "Search the docs content and return raw JSON results.",
  async execute({ query, limit }) {
    const search = await searchServer;

    return await search.searchAsync(query, {
      enrich: true,
      limit,
      merge: true,
    });
  },
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(10),
    query: z.string(),
  }),
});
